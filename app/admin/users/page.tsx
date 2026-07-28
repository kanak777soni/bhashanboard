import Link from "next/link";
import {
  banUser,
  resendUserVerification,
  revokeUserSessions,
  setUserRole,
  unbanUser,
} from "./actions";
import { listManagedUsers } from "@/lib/user-admin-store";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function pageNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function date(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function queryHref(search: string, page: number): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  // Keep authorization adjacent to the sensitive read. Layouts can be reused
  // during client navigation and are not the sole data-access boundary.
  const actor = await requireAdmin();
  const params = await searchParams;
  const search = (params.q ?? "").trim().slice(0, 120);
  const page = pageNumber(params.page);
  const users = await listManagedUsers({
    search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const total = users[0]?.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Registered users</h2>
          <p className="rail-note">
            {total.toLocaleString("en-IN")} account{total === 1 ? "" : "s"} in this view
          </p>
        </div>
        <form className="admin-filters" style={{ gridTemplateColumns: "minmax(220px, 1fr) auto" }}>
          <label className="field">
            <span className="lbl">Name or email</span>
            <input name="q" defaultValue={search} placeholder="Search the register" />
          </label>
          <button className="btn" type="submit">Search</button>
        </form>
      </div>

      <div className="tablewrap">
        <table className="ledger admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Activity</th>
              <th>Joined</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={5} className="empty">No registered users match this search.</td></tr>
            )}
            {users.map((user) => {
              const banExpired = user.banExpires
                ? new Date(user.banExpires).getTime() <= Date.now()
                : false;
              const activelyBanned = user.banned && !banExpired;
              const isSelf = actor.id === user.id;
              const canPromote = user.emailVerified && !activelyBanned;
              const anonymized = Boolean(user.anonymizedAt);
              return (
                <tr key={user.id}>
                  <td>
                    <strong>{anonymized ? "Anonymized member" : user.name}</strong>
                    <div className="rail-note">
                      {anonymized ? `Opaque ID: ${user.id}` : user.email}
                    </div>
                    <div className="lbl" style={{ marginTop: 5 }}>
                      {anonymized
                        ? `Anonymized ${date(user.anonymizedAt!)}`
                        : user.newsletterOptIn
                          ? "Newsletter opted in"
                          : "No marketing consent"}
                    </div>
                  </td>
                  <td>
                    <span className={`stamp ${activelyBanned ? "" : "green"}`} style={{ display: "inline-block" }}>
                      {anonymized
                        ? "Anonymized"
                        : activelyBanned
                          ? "Banned"
                          : user.emailVerified
                            ? "Verified"
                            : "Unverified"}
                    </span>
                    <div className="rail-note" style={{ marginTop: 8 }}>
                      Role: <strong>{user.role}</strong>
                    </div>
                    {activelyBanned && (
                      <div className="rail-note" style={{ marginTop: 5 }}>
                        {user.banReason}
                        {user.banExpires ? ` · until ${date(user.banExpires)}` : " · indefinite"}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {user.validVotes} vote{user.validVotes === 1 ? "" : "s"}<br />
                    {user.qualifiedWatches} receipt{user.qualifiedWatches === 1 ? "" : "s"}<br />
                    {user.activeSessions} active session{user.activeSessions === 1 ? "" : "s"}
                  </td>
                  <td>{date(user.createdAt)}</td>
                  <td>
                    <div className="admin-actions">
                      <Link
                        className="linkbtn"
                        href={`/admin/users/${encodeURIComponent(user.id)}`}
                      >
                        Review votes
                      </Link>
                      {anonymized ? (
                        <span className="lbl">Profile and credentials removed</span>
                      ) : user.role === "admin" ? (
                        !isSelf && (
                          <form action={setUserRole}>
                            <input type="hidden" name="user_id" value={user.id} />
                            <input type="hidden" name="role" value="user" />
                            <button className="linkbtn" type="submit">Make user</button>
                          </form>
                        )
                      ) : canPromote ? (
                        <form action={setUserRole}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <input type="hidden" name="role" value="admin" />
                          <button className="linkbtn" type="submit">Make admin</button>
                        </form>
                      ) : (
                        <span className="lbl">Verify before promotion</span>
                      )}
                      {!anonymized && !user.emailVerified && (
                        <form action={resendUserVerification}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <button className="linkbtn" type="submit">Resend verification</button>
                        </form>
                      )}
                      {!anonymized && !isSelf && (
                        <form action={revokeUserSessions}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <button className="linkbtn" type="submit">Revoke sessions</button>
                        </form>
                      )}
                      {!anonymized && (activelyBanned ? (
                        <form action={unbanUser}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <button className="linkbtn" type="submit">Unban</button>
                        </form>
                      ) : !isSelf ? (
                        <details className="admin-ban-control">
                          <summary className="linkbtn danger">Ban account</summary>
                          <form action={banUser}>
                            <input type="hidden" name="user_id" value={user.id} />
                            <label className="field">
                              <span className="lbl">Reason</span>
                              <input name="reason" maxLength={240} required />
                            </label>
                            <label className="field">
                              <span className="lbl">Days (blank = indefinite)</span>
                              <input name="days" type="number" min={1} max={365} />
                            </label>
                            <button className="btn seal" type="submit">Confirm ban</button>
                          </form>
                        </details>
                      ) : null)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="tokens" aria-label="User pages">
          {page > 1 && <Link className="token" href={queryHref(search, page - 1)}>Previous</Link>}
          <span className="lbl">Page {Math.min(page, pages)} of {pages}</span>
          {page < pages && <Link className="token" href={queryHref(search, page + 1)}>Next</Link>}
        </nav>
      )}
    </section>
  );
}
