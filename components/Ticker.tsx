import Link from "next/link";
import { IN_PLACEMENT } from "@/lib/data";
import { tierByKey } from "@/lib/tiers";
import { PLACEMENT_DUELS } from "@/lib/elo";

export default function Ticker() {
  const items = IN_PLACEMENT.map((s) => ({
    href: `/statement/${s.slug}`,
    text: `Entry No. ${String(s.id).padStart(5, "0")} · placement ${s.placement} of ${PLACEMENT_DUELS} · projected ${
      tierByKey(s.projected ?? "gold").name
    }`,
  }));

  items.push({
    href: "/ledger",
    text: "The Committee has conferred one Kohinoor Class in the past 24 hours",
  });

  // Duplicated so the -50% translate loops seamlessly.
  const loop = [...items, ...items];

  return (
    <div className="ticker">
      <span className="ticker-tag">In placement</span>
      <div className="ticker-viewport">
        <div className="ticker-track">
          {loop.map((it, i) => (
            <Link key={i} href={it.href} aria-hidden={i >= items.length}>
              {it.text}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
