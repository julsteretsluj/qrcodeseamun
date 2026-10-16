"use client";

import { useMemo, useState, useTransition } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { RegistrationCheckin } from "@/lib/types";

function formatWhen(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CheckinsPanel({ initial }: { initial: RegistrationCheckin[] }) {
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.full_name, row.committee, row.allocation, row.short_id, row.placard_code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [query, rows]);

  function unregister(row: RegistrationCheckin) {
    const label = row.full_name ?? row.allocation;
    if (
      !window.confirm(
        `Unregister ${label} (${row.committee} · ${row.allocation})? They can check in again at the desk.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      setNotice(null);
      const supabase = createBrowserSupabase();
      if (!supabase) {
        setNotice("Could not reach the roster.");
        return;
      }
      const { data, error } = await supabase.rpc("unregister_registration_badge", {
        p_code: row.short_id,
      });
      const payload = data as { ok?: boolean } | null;
      if (error || !payload?.ok) {
        setNotice("That check-in could not be removed. Try again.");
        return;
      }
      setRows((current) => current.filter((item) => item.placard_code !== row.placard_code));
      setNotice(`Unregistered ${label}.`);
    });
  }

  return (
    <section className="checkins panel">
      <div className="checkins-head">
        <div>
          <h2>Checked in</h2>
          <p className="count">
            {rows.length === 0
              ? "No one is checked in yet."
              : `${rows.length} ${rows.length === 1 ? "person" : "people"} registered at the desk.`}
          </p>
        </div>
        {rows.length > 0 ? (
          <label className="checkins-search">
            <span className="sr-only">Search check-ins</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, committee, ID"
              autoComplete="off"
            />
          </label>
        ) : null}
      </div>

      {notice ? <p className="note">{notice}</p> : null}

      {filtered.length > 0 ? (
        <ul className="checkin-list">
          {filtered.map((row) => (
            <li key={row.placard_code}>
              <div>
                <p className="who">{row.full_name ?? "Unnamed seat"}</p>
                <p className="meta">
                  {row.committee} · {row.allocation}
                  {row.role === "chair" ? " · Chair" : ""}
                </p>
                <p className="meta quiet">
                  {row.short_id} · {formatWhen(row.registered_at)}
                </p>
              </div>
              <button
                className="button secondary"
                type="button"
                disabled={pending}
                onClick={() => unregister(row)}
              >
                Unregister
              </button>
            </li>
          ))}
        </ul>
      ) : rows.length > 0 ? (
        <p className="note">No check-ins match that search.</p>
      ) : null}
    </section>
  );
}
