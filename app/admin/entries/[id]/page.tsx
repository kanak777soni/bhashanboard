import Link from "next/link";
import { notFound } from "next/navigation";
import EntryForm from "@/components/admin/EntryForm";
import PublishGuard from "@/components/admin/PublishGuard";
import { computeLadder, getParties, getPoliticians, getStatement, getStatements, weightedScore } from "@/lib/store";
import { updateStatement } from "../../actions";

export default async function EditEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getStatement(id);
  if (!entry) notFound();

  const [people, parties, all] = await Promise.all([getPoliticians(), getParties(), getStatements()]);
  const placed = computeLadder(all).find((l) => l.id === id);

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>{entry.neutral_title}</h2>
          <Link className="btn ghost" href="/admin/entries">Back to entries</Link>
        </div>
        <div className="admin-cards">
          <div className="admin-card"><span className="lbl">Entry</span><b className="num">{entry.id}</b></div>
          <div className="admin-card"><span className="lbl">Rank</span><b className="num">{placed?.rank ?? "—"}</b></div>
          <div className="admin-card"><span className="lbl">GP</span><b className="num">{placed?.gp ?? "—"}</b></div>
          <div className="admin-card"><span className="lbl">Weighted score</span><b className="num">{weightedScore(entry.axes).toFixed(2)}</b></div>
          <div className="admin-card"><span className="lbl">Quote</span><b className="num">{entry.quote ? "yes" : "none"}</b></div>
        </div>
        <p className="rail-note" style={{ marginTop: 12 }}>
          <Link href={`/statement/${entry.neutral_title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72)}-${entry.id.toLowerCase()}`}>
            View this entry on the public site ↗
          </Link>
        </p>
      </section>

      <section className="admin-section">
        <PublishGuard entry={entry} />
        <EntryForm entry={entry} people={people} parties={parties} action={updateStatement} submitLabel="Save changes" />
      </section>
    </>
  );
}
