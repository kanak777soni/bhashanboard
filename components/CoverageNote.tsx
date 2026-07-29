import Link from "next/link";
import { getData } from "@/lib/data";

/**
 * Publishes the coverage imbalance instead of hiding it.
 *
 * The board previously held entries back so the party split would read as
 * even. That edits the display rather than the sampling, and tells the
 * reader something untrue about the record. The holdback is gone; this
 * block states the resulting skew and what it does and does not mean.
 */
export default async function CoverageNote() {
  const data = await getData();
  const bands = data.parity();
  const top = bands[0];
  const headOfLadder = data.publicRankedStatements().slice(0, 10);
  const topShare = headOfLadder.filter((s) => s.partyAtTime === top?.code).length;

  if (!top) {
    return (
      <section className="rail-block coverage">
        <h2>A note on coverage</h2>
        <p className="rail-note">No entries have been indexed yet.</p>
      </section>
    );
  }

  return (
    <section className="rail-block coverage">
      <h2>A note on coverage</h2>
      <p className="rail-note">
        <strong>
          {top?.code} accounts for {top?.pct}% of indexed entries
        </strong>
        {headOfLadder.length > 0 ? (
          <> and {topShare} of the current top ten public places.</>
        ) : (
          <>. No clip has reached the ten-vote mark yet.</>
        )}
      </p>
      <p className="rail-note" style={{ marginTop: 8 }}>
        This shows what is in the archive, not who is more or less sarcastic.
        Nothing is hidden just to make the party split look tidy.
      </p>
      <p className="rail-note" style={{ marginTop: 8 }}>
        The only fix is adding more clips from under-covered parties &mdash;
        never adjusting a score. <Link href="/ledger">The ledger records it.</Link>
      </p>
    </section>
  );
}
