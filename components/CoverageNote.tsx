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
  const headOfLadder = data.STATEMENTS.slice(0, 10);
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
        </strong>{" "}
        and {topShare} of the top ten places.
      </p>
      <p className="rail-note" style={{ marginTop: 8 }}>
        This measures <em>where we have looked</em>, not what anyone said. The corpus leans on claims
        about science and history, and has barely searched economics or deflection. Nothing is held
        back to make the split look even &mdash; that would edit the board instead of the research.
      </p>
      <p className="rail-note" style={{ marginTop: 8 }}>
        It is closed by sourcing more from under-covered parties. Never by adjusting a rating.{" "}
        <Link href="/ledger">The ledger records it.</Link>
      </p>
    </section>
  );
}
