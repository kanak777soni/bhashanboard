import Link from "next/link";
import AccountControls from "@/components/auth/AccountControls";
import { anonymizeMyAccount } from "./actions";
import { requireUser } from "@/lib/auth-guards";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await requireUser();
  const notice = (await searchParams).notice;
  const joined = new Date(user.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="admin-section" style={{ maxWidth: 760, margin: "28px auto 60px" }}>
      <span className="lbl" style={{ color: "var(--seal)" }}>Registered member</span>
      <h1 style={{ margin: "8px 0 22px" }}>{user.name}</h1>
      {notice === "admin-required" && (
        <div className="erratum" role="status" style={{ marginBottom: 22 }}>
          <p>This account is signed in, but it does not have administrator access.</p>
        </div>
      )}
      <table className="ledger" style={{ marginBottom: 28 }}>
        <tbody>
          <tr><th>Email</th><td>{user.email}</td></tr>
          <tr><th>Verification</th><td>{user.emailVerified ? "Verified" : "Awaiting verification"}</td></tr>
          <tr><th>Joined</th><td>{joined}</td></tr>
          <tr><th>Role</th><td>{user.role ?? "user"}</td></tr>
        </tbody>
      </table>
      <AccountControls newsletterOptIn={user.newsletterOptIn === true} />

      <section className="danger-zone" aria-labelledby="account-danger-title">
        <span className="lbl">Danger zone</span>
        <h2 id="account-danger-title">Anonymize this account</h2>
        <p id="account-danger-description">
          This is irreversible. Your name, email, credentials, active sessions, and email preference
          will be removed or replaced, and you will be signed out. Previously counted ballots will be
          excluded from public scores. Their original values, qualified watch receipts, exclusion
          events, and audit events remain under an opaque identifier so the ballot record cannot be
          silently rewritten.
        </p>
        <form className="admin-form" action={anonymizeMyAccount}>
          <label className="field">
            <span className="lbl">
              Type <strong>DELETE</strong> to confirm
            </span>
            <input
              name="confirmation"
              type="text"
              required
              pattern="DELETE"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="account-danger-description"
            />
          </label>
          <button className="btn seal" type="submit">
            Anonymize account permanently
          </button>
        </form>
        <p className="rail-note">
          Read the <Link href="/privacy">Privacy notice</Link> for the complete retention explanation.
        </p>
      </section>
    </section>
  );
}
