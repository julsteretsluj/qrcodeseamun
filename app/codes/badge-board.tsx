import { badgeDataUrl, badgeFileName } from "@/lib/badge-files";
import type { RosterBadge } from "@/lib/types";
import { ZipButton } from "./zip-button";

export async function BadgeBoard({ people }: { people: RosterBadge[] }) {
  const tiles = await Promise.all(
    people.map(async (person) => ({ person, src: await badgeDataUrl(person.short_id) }))
  );

  const groups: { committee: string; items: typeof tiles }[] = [];
  for (const tile of tiles) {
    const last = groups[groups.length - 1];
    if (!last || last.committee !== tile.person.committee) {
      groups.push({ committee: tile.person.committee, items: [tile] });
    } else {
      last.items.push(tile);
    }
  }

  return (
    <div>
      {groups.map((group) => (
        <section className="committee-group" key={group.committee}>
          <div className="group-head">
            <div>
              <h2>{group.committee}</h2>
              <p className="count">
                {group.items.length} {group.items.length === 1 ? "allocation" : "allocations"}
              </p>
            </div>
            <ZipButton
              variant="link"
              label={`Download ${group.committee} as ZIP`}
              zipLabel={group.committee}
              badges={group.items.map(({ person }) => ({
                short_id: person.short_id,
                committee: person.committee,
                allocation: person.allocation,
              }))}
            />
          </div>
          <div className="tiles">
            {group.items.map(({ person, src }) => (
              <article className="tile" key={person.placard_code}>
                <img src={src} alt={`QR code for allocation ID ${person.short_id}`} />
                <p className="badge-id">{person.short_id}</p>
                <p className="allocation">{person.allocation}</p>
                <p className="who">{person.full_name ?? "Open seat"}</p>
                <p className="seat">{person.role === "chair" ? "Chair" : "Delegate"}</p>
                <p className="code">{person.placard_code}</p>
                <a download={badgeFileName(person)} href={src}>
                  Download PNG
                </a>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
