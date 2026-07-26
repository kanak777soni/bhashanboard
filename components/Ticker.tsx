import Link from "next/link";
import { REJECTED, STATS } from "@/lib/data";

/**
 * The running head. Reports the true state of the record rather than
 * inventing activity: what is indexed, what is still missing, what was
 * refused. An archive that overstates its own completeness is worth less
 * than one that doesn't.
 */
export default function Ticker() {
  const items = [
    { href: "/ledger", text: `${STATS.indexed} entries indexed · ${STATS.onLadder} placed on the ladder · ${STATS.heldParity} held for parity` },
    { href: "/ledger", text: `${STATS.withVerbatimQuote} of ${STATS.indexed} entries carry an established verbatim quote — the rest await one` },
    { href: "/rejected", text: `${REJECTED.length} proposed statements refused under the Rules, each recorded with the rule that killed it` },
    { href: "/ledger", text: "No entry is verified for publication. Every one awaits a Tier A or B clip, a timestamp and a transcript." },
  ];

  // Duplicated so the -50% translate loops seamlessly.
  const loop = [...items, ...items];

  return (
    <div className="ticker">
      <span className="ticker-tag">State of the record</span>
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
