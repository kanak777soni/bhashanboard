import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import {
  getPublicSubmissions,
  type PublicSubmissionStatus,
} from "@/lib/submission-store";

const FILTERS: { value: "all" | PublicSubmissionStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "spam", label: "Spam" },
  { value: "all", label: "All" },
];

function validStatus(value: string | undefined): "all" | PublicSubmissionStatus {
  return FILTERS.some((filter) => filter.value === value)
    ? (value as "all" | PublicSubmissionStatus)
    : "pending";
}

function statusClass(status: PublicSubmissionStatus): string {
  if (status === "accepted") return "reply";
  if (status === "rejected" || status === "spam") return "withdrawal";
  return "correction";
}

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = validStatus(params.status);
  const all = await getPublicSubmissions({ limit: 500 });
  const rows =
    status === "all"
      ? all
      : all.filter((submission) => submission.status === status);
  const counts = all.reduce<Record<string, number>>((result, submission) => {
    result[submission.status] = (result[submission.status] ?? 0) + 1;
    return result;
  }, {});

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Reader suggestions</h2>
          <p className="rail-note">
            New suggestions stay private. Accepting one creates a draft that
            you can finish in the same Draft &rarr; Preview &rarr; Live editor.
          </p>
        </div>
        <span className="stamp">{counts.pending ?? 0} pending</span>
      </div>

      {params.notice === "reviewed" && (
        <p className="admin-notice">Submission decision recorded.</p>
      )}

      <nav className="submission-filters" aria-label="Submission status">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/submissions?status=${filter.value}`}
            aria-current={filter.value === status ? "page" : undefined}
          >
            {filter.label}
            {filter.value !== "all" && (
              <span className="num"> {counts[filter.value] ?? 0}</span>
            )}
          </Link>
        ))}
      </nav>

      <div className="tablewrap">
        <table className="ledger admin-table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Received</th>
              <th>Suggested moment</th>
              <th style={{ width: 130 }}>Speaker</th>
              <th style={{ width: 100 }}>Clip link</th>
              <th style={{ width: 96 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  No submissions in this queue.
                </td>
              </tr>
            )}
            {rows.map((submission) => (
              <tr key={submission.id}>
                <td className="num" style={{ fontSize: 12 }}>
                  {submission.createdAt.replace("T", " ").slice(0, 16)}
                </td>
                <td>
                  <Link
                    href={`/admin/submissions/${submission.id}`}
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 16,
                    }}
                  >
                    {submission.claim}
                  </Link>
                  <div className="entry-sub">
                    SUB-
                    {submission.id
                      .replaceAll("-", "")
                      .slice(0, 12)
                      .toUpperCase()}{" "}
                    ·{" "}
                    {submission.originalLanguage}
                    {submission.draftStatementId &&
                      ` · ${submission.draftStatementId}`}
                  </div>
                </td>
                <td>{submission.speaker}</td>
                <td>
                  <span className="kind">{submission.sourcePlatform}</span>
                </td>
                <td>
                  <span className={`kind ${statusClass(submission.status)}`}>
                    {submission.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
