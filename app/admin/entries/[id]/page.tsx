import Link from "next/link";
import { notFound } from "next/navigation";
import EntryForm from "@/components/admin/EntryForm";
import SarcasmProfileFields from "@/components/admin/SarcasmProfileFields";
import { cloudinaryConfigurationIssues } from "@/lib/cloudinary-config";
import { slugify } from "@/lib/corpus";
import { statementReadiness } from "@/lib/readiness";
import { requireAdmin } from "@/lib/require-admin";
import { provisionalClassFromStoredAxes } from "@/lib/sarcasm";
import {
  getParties,
  getPoliticians,
  getStatement,
  getStatementVoteCount,
} from "@/lib/store";
import { getStatementRating } from "@/lib/vote-store";
import {
  publishStatement,
  restoreStatement,
  saveStatementDraft,
  setStatus,
  updateSarcasmProfile,
} from "../../actions";

export default async function EditEntry({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const entry = await getStatement(id);
  if (!entry) notFound();

  const [people, parties, voteCount, rating] = await Promise.all([
    getPoliticians(),
    getParties(),
    getStatementVoteCount(id),
    getStatementRating(id),
  ]);
  const validVoteCount = rating?.validVoteCount ?? 0;
  const publicGp = rating?.gp ?? 1500;
  const readiness = statementReadiness(entry);
  const resultNotice =
    query.result === "live"
      ? {
          label: "Now live",
          message: "The clip is on Watch and can receive verified user votes.",
        }
      : query.result === "restored"
        ? {
            label: "Back live",
            message: "The unchanged voted clip is live again.",
          }
        : query.result === "saved"
          ? {
              label: "Draft saved",
              message: "Your changes are saved. The clip remains offline.",
            }
          : query.result === "profile"
            ? {
                label: "Profile saved",
                message:
                  validVoteCount >= 10
                    ? "The four marks are updated. Public GP and class remain vote-only."
                    : "The four marks and Board provisional class are updated. Public GP remains vote-only.",
              }
          : undefined;

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
                <button className="btn warning" type="submit">
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
            <span className="lbl">Valid votes</span>
            <b className="num">{validVoteCount}</b>
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
        {resultNotice && (
          <div className="guard clear" role="status" style={{ marginTop: 14 }}>
            <span className="lbl">{resultNotice.label}</span>
            <p>{resultNotice.message}</p>
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <span className="lbl">Four equal marks</span>
            <h2>Sarcasm Profile and provisional class</h2>
          </div>
        </div>
        <form action={updateSarcasmProfile} className="admin-form">
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="version" value={entry.version} />
          <fieldset>
            <legend>Judge the moment, not the person</legend>
            <p className="rail-note">
              Logic Break, Reality Gap, Full Confidence, and Comic Impact are
              all weighted equally. Before ten valid votes they calculate a
              clearly provisional class. They never change public GP, ballots,
              rank, Standings, or Hall eligibility.
            </p>
            <SarcasmProfileFields
              initialAxes={entry.axes}
              validVoteCount={validVoteCount}
              publicGp={publicGp}
            />
            <button className="btn seal" type="submit">
              Save profile and preview
            </button>
          </fieldset>
        </form>
      </section>

      <section className="admin-section">
        <EntryForm
          entry={entry}
          people={people}
          parties={parties}
          saveAction={saveStatementDraft}
          publishAction={publishStatement}
          restoreAction={restoreStatement}
          hasVotes={voteCount > 0}
          profileComplete={Boolean(
            provisionalClassFromStoredAxes(entry.axes),
          )}
          cloudinaryConfigurationIssues={cloudinaryConfigurationIssues()}
        />
      </section>
    </>
  );
}
