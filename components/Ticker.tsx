import Link from "next/link";
import { getData } from "@/lib/data";

/**
 * The running head. Reports the true state of the record rather than
 * inventing activity: what is indexed, what is still missing, what was
 * refused. An archive that overstates its own completeness is worth less
 * than one that doesn't.
 */
export default async function Ticker() {
  const { REJECTED, STATS } = await getData();
  const items = [
    { href: "/ledger", text: `${STATS.indexed} entries indexed · ${STATS.onLadder} placed on the ladder · ${STATS.heldParity} held for parity` },
    { href: "/ledger", text: `${STATS.withVerbatimQuote} of ${STATS.indexed} entries carry an established verbatim quote — the rest await one` },
    { href: "/rejected", text: `${REJECTED.length} proposed statements refused under the Rules, each recorded with the rule that killed it` },
    { href: "/ledger", text: "No entry is verified for publication. Every one awaits a Tier A or B clip, a timestamp and a transcript." },
  ];

  const tickerGroup = (duplicate = false) => (
    <div className="ticker-group" aria-hidden={duplicate || undefined}>
      {items.map((item, index) => (
        <Link
          key={`${item.href}-${index}`}
          href={item.href}
          tabIndex={duplicate ? -1 : undefined}
        >
          {item.text}
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <Link
        className="ticker-mobile"
        href="/ledger"
        aria-label={`Record status: ${STATS.indexed} entries indexed; ${STATS.onLadder} on the ladder; ${STATS.heldParity} held for parity`}
      >
        <span className="ticker-mobile-label">Record status</span>
        <span className="ticker-mobile-counts" aria-hidden="true">
          <span className="num">{STATS.indexed}</span> indexed &middot;{" "}
          <span className="num">{STATS.onLadder}</span> on ladder &middot;{" "}
          <span className="num">{STATS.heldParity}</span> held
        </span>
      </Link>

      <div className="ticker ticker-desktop">
        <span className="ticker-tag">State of the record</span>
        <div className="ticker-viewport">
          <div className="ticker-track">
            {tickerGroup()}
            {tickerGroup(true)}
          </div>
        </div>
      </div>
    </>
  );
}
