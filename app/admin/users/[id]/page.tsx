import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { getManagedUser } from "@/lib/user-admin-store";
import { getUserVoteHistory } from "@/lib/vote-store";
import { excludeUserVote } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const VALUE_LABELS: Record<number, string> = {
  0: "Flat",
  25: "Wry",
  50: "Sharp",
  75: "Savage",
  100: "Historic",
};

function pageNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function date(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pageHref(userId: string, page: number): string {
  const base = `/admin/users/${encodeURIComponent(userId)}`;
  return page > 1 ? `${base}?page=${page}` : base;
}

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  // Keep authorization adjacent to the sensitive history read instead of
  // relying on the parent layout as the sole data-access boundary.
  await requireAdmin();
  const userId = (await params).id;
  const page = pageNumber((await searchParams).page);
  const [user, history] = await Promise.all([
    getManagedUser(userId),
    getUserVoteHistory(userId, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);
  if (!user) notFound();

  const pages = Math.max(1, Math.ceil(history.total / PAGE_SIZE));
  if (history.total > 0 && page > pages) {
    redirect(pageHref(userId, pages));
  }
  const activeBan =
    user.banned &&
    (!user.banExpires || new Date(user.banExpires).getTime() > Date.now());
  const anonymized = Boolean(user.anonymizedAt);

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <Link className="lbl" href="/admin/users">← Registered users</Link>
          <h2 style={{ marginTop: 8 }}>{anonymized ? "Anonymized member" : user.name}</h2>
          <p className="rail-note">
            {anonymized ? `Opaque ID: ${user.id}` : user.email} · {user.role} ·{" "}
            {anonymized
              ? "profile and credentials removed"
              : activeBan
                ? "banned"
                : user.emailVerified
                  ? "verified"
                  : "unverified"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="num">{history.total.toLocaleString("en-IN")}</span>
          <div className="lbl">Immutable ballot{history.total === 1 ? "" : "s"}</div>
        </div>
      </div>

      <p className="rail-note" style={{ marginBottom: 14 }}>
        Ballots are never edited or deleted. An exclusion appends a permanent
        moderation record, updates the public aggregate, and writes an audit event
        in the same transaction.
      </p>

      <div className="tablewrap">
        <table className="ledger admin-table">
          <thead>
            <tr>
              <th>Statement</th>
              <th>Ruling</th>
              <th>Entered</th>
              <th>Status and moderation</th>
            </tr>
          </thead>
          <tbody>
            {history.items.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">This account has not entered a ruling.</td>
              </tr>
            )}
            {history.items.map((item) => (
              <tr key={item.voteId}>
                <td>
                  <Link href={`/admin/entries/${encodeURIComponent(item.statementId)}`}>
                    {item.neutralTitle}
                  </Link>
                  <div className="lbl" style={{ marginTop: 4 }}>
                    {item.statementId} · vote {item.voteId}
                  </div>
                </td>
                <td>
                  <span className="num">{item.value}</span> · {VALUE_LABELS[item.value]}
                </td>
                <td>{date(item.createdAt)}</td>
                <td>
                  {item.excluded ? (
                    <>
                      <span className="kind correction">Excluded</span>
                      <div className="rail-note" style={{ marginTop: 7 }}>
                        <strong>Reason:</strong> {item.exclusionReason}
                      </div>
                      {item.excludedAt && (
                        <div className="lbl" style={{ marginTop: 5 }}>
                          {date(item.excludedAt)}
                          {item.excludedBy ? ` · ${item.excludedBy}` : ""}
                        </div>
                      )}
                    </>
                  ) : (
                    <details className="admin-ban-control">
                      <summary className="linkbtn danger">Exclude from rating</summary>
                      <form action={excludeUserVote}>
                        <input type="hidden" name="user_id" value={user.id} />
                        <input type="hidden" name="vote_id" value={item.voteId} />
                        <label className="field">
                          <span className="lbl">Permanent audit reason</span>
                          <textarea
                            name="reason"
                            rows={3}
                            minLength={3}
                            maxLength={500}
                            required
                          />
                        </label>
                        <button className="btn seal" type="submit">
                          Confirm exclusion
                        </button>
                      </form>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="tokens" aria-label="Vote-history pages">
          {page > 1 && (
            <Link className="token" href={pageHref(userId, page - 1)}>Previous</Link>
          )}
          <span className="lbl">Page {page} of {pages}</span>
          {page < pages && (
            <Link className="token" href={pageHref(userId, page + 1)}>Next</Link>
          )}
        </nav>
      )}
    </section>
  );
}
