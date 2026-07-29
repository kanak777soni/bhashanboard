import Link from "next/link";
import { notFound } from "next/navigation";
import EntryForm from "@/components/admin/EntryForm";
import { cloudinaryConfigurationIssues } from "@/lib/cloudinary-config";
import { slugify } from "@/lib/corpus";
import { statementReadiness } from "@/lib/readiness";
import { requireAdmin } from "@/lib/require-admin";
import {
  getParties,
  getPoliticians,
  getStatement,
  getStatementVoteCount,
} from "@/lib/store";
import { setStatus, updateStatement } from "../../actions";

export default async function EditEntry({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const entry = await getStatement(id);
  if (!entry) notFound();

  const [people, parties, voteCount] = await Promise.all([
    getPoliticians(),
    getParties(),
    getStatementVoteCount(id),
  ]);
  const readiness = statementReadiness(entry);

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>{entry.neutral_title}</h2>
          <div className="admin-actions">
            {readiness.key === "live" && (
              <form action={setStatus}>
                <input type="hidden" name="id" value={entry.id} />
                <input type="hidden" name="status" value="held_review" />
                <button className="btn ghost" type="submit">
                  Take offline
                </button>
              </form>
            )}
            <Link className="btn ghost" href="/admin/entries">
              Back to entries
            </Link>
          </div>
        </div>
        <div className="admin-cards">
          <div className="admin-card">
            <span className="lbl">Entry</span>
            <b className="num">{entry.id}</b>
          </div>
          <div className="admin-card">
            <span className="lbl">Workflow</span>
            <b>{readiness.key === "live" ? "Live" : "Draft"}</b>
          </div>
          <div className="admin-card">
            <span className="lbl">Clip</span>
            <b>{entry.video?.platform ?? "missing"}</b>
          </div>
          <div className="admin-card">
            <span className="lbl">Category</span>
            <b>{entry.category || "missing"}</b>
          </div>
          <div className="admin-card">
            <span className="lbl">Votes</span>
            <b className="num">{voteCount}</b>
          </div>
          <div className="admin-card">
            <span className="lbl">Quote</span>
            <b className="num">{entry.quote ? "added" : "missing"}</b>
          </div>
        </div>
        <p className="rail-note" style={{ marginTop: 12 }}>
          {readiness.key !== "live" ? (
            "This is a draft. Its public video page appears when you choose Go live."
          ) : (
            <Link
              href={`/statement/${slugify(
                `${entry.neutral_title}-${entry.id}`
              )}`}
            >
              View this live entry on the public site &rarr;
            </Link>
          )}
        </p>
      </section>

      <section className="admin-section">
        <EntryForm
          entry={entry}
          people={people}
          parties={parties}
          action={updateStatement}
          hasVotes={voteCount > 0}
          cloudinaryConfigurationIssues={cloudinaryConfigurationIssues()}
        />
      </section>
    </>
  );
}
