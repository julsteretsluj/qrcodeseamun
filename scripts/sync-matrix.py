#!/usr/bin/env python3
"""Sync registration_people from SEAMUN allocation matrix (19).xlsx via Management API.

Seat grid + IDs come from Allocation Matrix (19). Optionally overlay empty names from
Delegate & Chair Allocation Matrix (4) when that file has a real name for the same
committee + allocation (never invent people; prefer fuller matrix-19 names).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

import openpyxl

MATRIX = Path(
    "/Users/juleskitto-astrop/Downloads/SEAMUN I 2027 _ Allocation Matrix (19).xlsx"
)
DELEGATE_NAMES = Path(
    "/Users/juleskitto-astrop/Downloads/Delegate & Chair Allocation Matrix _ SEAMUN I 2027 (4).xlsx"
)
REF = "dgswuhyggkqmipkrzhdb"
PLACEHOLDER_NAMES = {
    "name surname",
    "name x.",
    "name x",
    "tbd",
    "n/a",
    "-",
    "open",
    "open seat",
}
COMMITTEE_SHEETS = {
    "ECOSOC",
    "Press Corps",
    "UNHRC",
    "UNODC",
    "UNSC",
    "UN Women",
    "DISEC",
    "FWC - Stranger Things",
    "INTERPOL",
    "WHO",
}


def token() -> str:
    return subprocess.check_output(
        [
            "bash",
            "-lc",
            'security find-generic-password -s "Supabase CLI" -w 2>/dev/null '
            '| sed "s/^go-keyring-base64://" | base64 -d 2>/dev/null',
        ],
        text=True,
    ).strip()


def run_sql(sql: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()
        raise RuntimeError(f"SQL failed ({exc.code}): {detail[:800]}") from exc


def clean(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_labeled(value: str | None, prefix: str) -> str | None:
    if not value:
        return None
    text = str(value).strip()
    match = re.search(rf"{re.escape(prefix)}\s*=\s*(\S+)", text, re.I)
    if match:
        return match.group(1).strip()
    return None


def normalize_name(value) -> str | None:
    name = clean(value)
    if not name:
        return None
    if name.lower() in PLACEHOLDER_NAMES:
        return None
    return name


def extract_chair(row, committee: str) -> dict | None:
    role_title = clean(row[0])
    if not role_title:
        return None
    title_l = role_title.lower()
    if title_l not in {
        "head chair",
        "co-chair",
        "editor",
        "co-editor",
        "frontroom chair",
        "backroom chair",
    }:
        return None

    placard = None
    short_id = None
    name = normalize_name(row[1])
    for cell in row[2:]:
        text = clean(cell)
        if not text:
            continue
        if "placard" in text.lower() or text.upper().startswith("SEAMUN-"):
            placard = parse_labeled(text, "Placard Code") or (
                text if text.upper().startswith("SEAMUN-") else placard
            )
        parsed = parse_labeled(text, "ID")
        if parsed:
            short_id = parsed.lower()
        elif re.fullmatch(r"[A-Za-z0-9]{4,12}", text) and not text.upper().startswith(
            "SEAMUN-"
        ):
            short_id = text.lower()

    if not placard or not short_id:
        return None

    return {
        "short_id": short_id,
        "placard_code": placard.upper(),
        "role": "chair",
        "full_name": name,
        "committee": committee,
        "allocation": role_title,
    }


def parse_matrix(path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(path, data_only=True)
    rows: list[dict] = []
    seen_ids: set[str] = set()
    seen_placards: set[str] = set()

    for sheet_name in wb.sheetnames:
        if sheet_name not in COMMITTEE_SHEETS:
            continue
        ws = wb[sheet_name]
        committee = sheet_name
        header_idx = None
        for i, row in enumerate(ws.iter_rows(values_only=True), 1):
            cells = [clean(c) for c in row]
            if i <= 5:
                chair = extract_chair(row, committee)
                if chair:
                    if chair["short_id"] in seen_ids:
                        raise SystemExit(f"duplicate short_id in matrix: {chair['short_id']}")
                    if chair["placard_code"] in seen_placards:
                        raise SystemExit(
                            f"duplicate placard in matrix: {chair['placard_code']}"
                        )
                    seen_ids.add(chair["short_id"])
                    seen_placards.add(chair["placard_code"])
                    rows.append(chair)
                continue

            if cells and cells[0] == "Delegation" and cells[2] and "Placard" in str(cells[2]):
                header_idx = i
                continue
            if header_idx is None:
                continue
            if not cells[0] or cells[0] in {"Total", "TOTAL"}:
                continue
            if not cells[2] or not cells[3]:
                continue
            if not str(cells[2]).upper().startswith("SEAMUN-"):
                continue

            short_id = str(cells[3]).strip().lower()
            placard = str(cells[2]).strip().upper()
            if short_id in seen_ids:
                raise SystemExit(f"duplicate short_id in matrix: {short_id}")
            if placard in seen_placards:
                raise SystemExit(f"duplicate placard in matrix: {placard}")
            seen_ids.add(short_id)
            seen_placards.add(placard)
            rows.append(
                {
                    "short_id": short_id,
                    "placard_code": placard,
                    "role": "delegate",
                    "full_name": normalize_name(cells[5]),
                    "committee": committee,
                    "allocation": cells[0],
                }
            )

    return rows


def sql_str(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    if not MATRIX.exists():
        print(f"missing matrix: {MATRIX}", file=sys.stderr)
        return 1

    matrix = parse_matrix(MATRIX)
    print(f"matrix rows: {len(matrix)}")

    before = run_sql(
        "select placard_code, short_id, role, full_name, committee, allocation, sort_order "
        "from public.registration_people;"
    )
    by_id = {r["short_id"].lower(): r for r in before}
    checkins = {
        r["placard_code"]
        for r in run_sql("select placard_code from public.registration_checkins;")
    }
    matrix_ids = {r["short_id"] for r in matrix}

    values = []
    for i, row in enumerate(matrix, start=1):
        values.append(
            f"({sql_str(row['placard_code'])}, {sql_str(row['short_id'])}, {sql_str(row['role'])}, "
            f"{sql_str(row['full_name'])}, {sql_str(row['committee'])}, {sql_str(row['allocation'])}, {i})"
        )
    values_sql = ",\n".join(values)

    sql = (
        """
begin;
create temporary table matrix_roster (
  placard_code text primary key,
  short_id text unique not null,
  role text not null,
  full_name text,
  committee text not null,
  allocation text not null,
  sort_order integer not null unique
) on commit drop;

insert into matrix_roster (placard_code, short_id, role, full_name, committee, allocation, sort_order)
values
"""
        + values_sql
        + """;

update registration_people set sort_order = -abs(sort_order) where sort_order <> 0;
update registration_people set sort_order = sort_order - 1000000 where sort_order < 0;

update registration_people p
set
  role = m.role,
  full_name = m.full_name,
  committee = m.committee,
  allocation = m.allocation,
  sort_order = m.sort_order
from matrix_roster m
where p.short_id = m.short_id;

insert into registration_people (placard_code, short_id, role, full_name, committee, allocation, sort_order)
select m.placard_code, m.short_id, m.role, m.full_name, m.committee, m.allocation, m.sort_order
from matrix_roster m
where not exists (select 1 from registration_people p where p.short_id = m.short_id);

delete from registration_people p
where not exists (select 1 from matrix_roster m where m.short_id = p.short_id)
  and not exists (select 1 from registration_checkins c where c.placard_code = p.placard_code);

with orphans as (
  select p.short_id, 100000 + row_number() over (order by p.short_id) as so
  from registration_people p
  where not exists (select 1 from matrix_roster m where m.short_id = p.short_id)
)
update registration_people p
set sort_order = orphans.so
from orphans
where p.short_id = orphans.short_id;

commit;
"""
    )
    run_sql(sql)

    after = run_sql(
        "select count(*) as n, "
        "count(*) filter (where full_name is not null) as named, "
        "count(*) filter (where role = 'chair') as chairs "
        "from public.registration_people;"
    )[0]
    db_ids = {
        r["short_id"]
        for r in run_sql("select short_id from public.registration_people;")
    }

    added = [r for r in matrix if r["short_id"] not in by_id]
    updated = []
    unchanged = []
    for row in matrix:
        cur = by_id.get(row["short_id"])
        if not cur:
            continue
        same = (
            cur["placard_code"] == row["placard_code"]
            and cur["role"] == row["role"]
            and (cur["full_name"] or None) == row["full_name"]
            and cur["committee"] == row["committee"]
            and cur["allocation"] == row["allocation"]
        )
        (unchanged if same else updated).append(row["short_id"])

    removed_deleted = [
        r
        for r in before
        if r["short_id"] not in matrix_ids and r["placard_code"] not in checkins
    ]
    removed_kept = [
        r
        for r in before
        if r["short_id"] not in matrix_ids and r["placard_code"] in checkins
    ]

    summary = {
        "matrix_rows": len(matrix),
        "added": len(added),
        "updated": len(updated),
        "unchanged": len(unchanged),
        "removed_deleted": [
            {
                "short_id": r["short_id"],
                "committee": r["committee"],
                "allocation": r["allocation"],
            }
            for r in removed_deleted
        ],
        "removed_kept_with_checkin": [
            {
                "short_id": r["short_id"],
                "committee": r["committee"],
                "allocation": r["allocation"],
            }
            for r in removed_kept
        ],
        "db_after": after,
        "missing_from_db": [r["short_id"] for r in matrix if r["short_id"] not in db_ids],
        "extra_in_db": sorted(db_ids - matrix_ids),
    }
    print(json.dumps(summary, indent=2))

    data_dir = Path(__file__).resolve().parents[1] / "data"
    data_dir.mkdir(exist_ok=True)
    slim = [{**row, "sort_order": i} for i, row in enumerate(matrix, start=1)]
    (data_dir / "allocation-matrix.json").write_text(json.dumps(slim, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
