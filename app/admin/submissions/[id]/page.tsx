import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { getPublicSubmission } from "@/lib/submission-store";
import { getParties, getPoliticians } from "@/lib/store";
import { acceptSubmissionToDraft, closeSubmission } from "../actions";

const CATEGORIES = [
  "Science & Reason",
  "History",
  "Economics",
  "Whataboutery",
  "Standing Ovation",
];

function timestamp(value: number | null): string {
  if (value === null) return "Not supplied";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  return hours
    ? [hours, minutes, seconds]
        .map((part) => String(part).padStart(2, "0"))
        .join(":")
    : [minutes, seconds]
        .map((part) => String(part).padStart(2, "0"))
        .join(":");
}

export default async function AdminSubmissionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    notFound();
  }
  const [record, people, parties] = await Promise.all([
    getPublicSubmission(id),
    getPoliticians(),
    getParties(),
  ]);
  if (!record) notFound();
  const { submission, events } = record;
  const reference = `SUB-${submission.id
    .replaceAll("-", "")
    .slice(0, 12)
    .toUpperCase()}`;

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <p className="lbl">{reference}</p>
            <h2>Review reader suggestion</h2>
          </div>
          <Link href="/admin/submissions">← Back to queue</Link>
        </div>

        <div className="submission-review-grid">
          <div>
            <span className="lbl">Suggested caption</span>
            <p className="submission-claim">{submission.claim}</p>
          </div>
          <dl className="submission-facts">
            <div>
              <dt>Speaker supplied</dt>
              <dd>{submission.speaker}</dd>
            </div>
            <div>
              <dt>Event supplied</dt>
              <dd>{submission.eventContext || "Not supplied"}</dd>
            </div>
            <div>
              <dt>Original language</dt>
              <dd>{submission.originalLanguage}</dd>
            </div>
            <div>
              <dt>Excerpt</dt>
              <dd>
                {timestamp(submission.startSeconds)} →{" "}
                {timestamp(submission.endSeconds)}
              </dd>
            </div>
            <div>
              <dt>Submitted by</dt>
              <dd>{submission.submitterName || "Name withheld"}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>
                <a href={`mailto:${submission.contactEmail}`}>
                  {submission.contactEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt>Acknowledgement</dt>
              <dd>{submission.acknowledgementStatus.replace("_", " ")}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{submission.status}</dd>
            </div>
          </dl>
          <div className="submission-source">
            <span className="lbl">{submission.sourcePlatform} clip link</span>
            <a
              href={submission.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open submitted link &rarr;
            </a>
            <code>{submission.sourceUrl}</code>
          </div>
        </div>
      </section>

      {submission.status === "pending" ? (
        <section className="admin-section">
          <h2>Decision</h2>
          <div className="submission-decision-grid">
            <form action={acceptSubmissionToDraft} className="admin-form">
              <input type="hidden" name="id" value={submission.id} />
              <input
                type="hidden"
                name="version"
                value={submission.version}
              />
              <fieldset>
                <legend>Accept into a private draft</legend>
                <p className="rail-note">
                  Choose the speaker, party and category now. We will open the
                  result as a private draft; nothing goes live automatically.
                </p>
                <label className="field">
                  <span className="lbl">Speaker</span>
                  <select name="speaker_id" required defaultValue="">
                    <option value="">Select…</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} · {person.party}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="lbl">Party at the time</span>
                  <select name="party_at_time" required defaultValue="">
                    <option value="">Select…</option>
                    {parties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.id} · {party.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="lbl">Category</span>
                  <select name="category" required defaultValue="">
                    <option value="">Select…</option>
                    {CATEGORIES.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <button className="btn seal" type="submit">
                  Create private draft
                </button>
              </fieldset>
            </form>

            <form action={closeSubmission} className="admin-form">
              <input type="hidden" name="id" value={submission.id} />
              <input
                type="hidden"
                name="version"
                value={submission.version}
              />
              <fieldset>
                <legend>Close without a draft</legend>
                <label className="field">
                  <span className="lbl">Decision</span>
                  <select name="disposition" defaultValue="rejected">
                    <option value="rejected">Decline suggestion</option>
                    <option value="spam">Mark as spam</option>
                  </select>
                </label>
                <label className="field">
                  <span className="lbl">Private note</span>
                  <textarea
                    name="note"
                    minLength={3}
                    maxLength={1000}
                    required
                    placeholder="Why this suggestion was closed"
                  />
                </label>
                <button className="btn danger" type="submit">
                  Record decision
                </button>
              </fieldset>
            </form>
          </div>
        </section>
      ) : (
        <section className="admin-section">
          <h2>Decision recorded</h2>
          <p>{submission.reviewNote}</p>
          {submission.draftStatementId && (
            <Link
              className="btn seal"
              href={`/admin/entries/${submission.draftStatementId}`}
            >
              Open draft {submission.draftStatementId}
            </Link>
          )}
        </section>
      )}

      <section className="admin-section">
        <h2>Activity</h2>
        <table className="ledger">
          <thead>
            <tr>
              <th style={{ width: 150 }}>When</th>
              <th style={{ width: 170 }}>Event</th>
              <th style={{ width: 190 }}>Actor</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <tr key={`${event.occurredAt}-${index}`}>
                <td className="num" style={{ fontSize: 12 }}>
                  {event.occurredAt.replace("T", " ").slice(0, 16)}
                </td>
                <td>{event.event.replaceAll("_", " ")}</td>
                <td>{event.actor}</td>
                <td>{event.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
