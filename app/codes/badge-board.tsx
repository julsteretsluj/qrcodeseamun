import QRCode from "qrcode";
import type { RosterBadge } from "@/lib/types";

export async function BadgeBoard({ people }: { people: RosterBadge[] }) {
  const tiles = await Promise.all(
    people.map(async (person) => {
      const src = await QRCode.toDataURL(person.placard_code, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: "M",
        color: { dark: "#1D1D1F", light: "#FFFFFF" },
      });
      return { person, src };
    })
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
          <h2>{group.committee}</h2>
          <p className="count">
            {group.items.length} {group.items.length === 1 ? "allocation" : "allocations"}
          </p>
          <div className="tiles">
            {group.items.map(({ person, src }) => (
              <article className="tile" key={person.placard_code}>
                <img src={src} alt="" />
                <p className="allocation">{person.allocation}</p>
                <p className="who">{person.full_name ?? "Open seat"}</p>
                <p className="seat">{person.role === "chair" ? "Chair" : "Delegate"}</p>
                <p className="code">{person.placard_code}</p>
                <a download={`${person.placard_code}.png`} href={src}>
                  Download
                </a>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
