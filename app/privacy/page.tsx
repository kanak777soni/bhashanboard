import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";

const configuredPrivacyEmail = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim();
const PRIVACY_EMAIL =
  configuredPrivacyEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredPrivacyEmail)
    ? configuredPrivacyEmail
    : undefined;

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How The Bhashan Board collects, uses, retains, and anonymizes account and voting data.",
};

export default function PrivacyPage() {
  return (
    <SiteFrame>
      <article className="document">
        <h1 className="page-title">Privacy notice</h1>
        <p className="legal-date">Last updated 29 July 2026</p>
        <p>
          The Bhashan Board is a pre-launch public-interest satire and archive project. This notice
          explains what the service records when you create an account, watch a source excerpt, or
          enter a ruling. It also explains the narrow set of records that must survive account
          anonymization so the public tally cannot be rewritten.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> display name, email address, a password hash
            (never the password itself), email-verification state, account role and restriction
            state, newsletter choice, and relevant timestamps.
          </li>
          <li>
            <strong>Security information:</strong> session tokens, session expiry, IP address and
            user-agent information associated with a session, and one-way-hashed rate-limit keys
            used to deter automated abuse.
          </li>
          <li>
            <strong>Viewing records:</strong> the statement and bounded video excerpt, player
            position and state, whether the page was visible, credited watch time, timestamps, and
            the resulting watch receipt. The timed gate is an abuse-control measure; it cannot prove
            what a person understood or believed.
          </li>
          <li>
            <strong>Rulings:</strong> the statement, fixed ballot value, watch receipt, rating-model
            version, and submission time. Each verified account can rule only once on a statement,
            and a submitted ruling cannot be edited.
          </li>
          <li>
            <strong>Moderation and audit records:</strong> exclusions, account restrictions,
            administrator actions, reasons, timestamps, and pseudonymous actor or subject
            identifiers needed to make those actions reviewable.
          </li>
          <li>
            <strong>Evidence submissions:</strong> the source link, proposed timestamps, speaker,
            event details, claim, original language, optional submitter name, contact email,
            declaration, moderation decision, and acknowledgement-delivery state. Submissions enter
            a private review queue and are not published automatically.
          </li>
          <li>
            <strong>Operational logs:</strong> limited request, error, and delivery logs maintained
            by the application and its hosting, database, video, and email providers.
          </li>
        </ul>

        <h2>Why we use it</h2>
        <p>
          We use account data to verify membership, secure the service, send account messages, and
          honour your communication preference. Viewing and ruling data enforce one watched excerpt
          and one final ballot per account, calculate the published performance bar, investigate
          abuse, and preserve an auditable public record. Submission data lets the Committee
          investigate an evidence lead, contact the submitter about that lead, and create a private
          research draft if it is accepted. We do not sell personal information or use private
          account or submission data to rank a politician or target political advertising.
        </p>

        <h2>Email and Brevo</h2>
        <p>
          Brevo delivers verification, password-reset, welcome, and evidence-receipt messages. When
          one of those messages is sent, Brevo receives the recipient name and email, message
          content, and—where applicable—an expiring action link, and may keep delivery and security
          logs under its own terms.
          Occasional Board updates are optional: the choice is off by default, stored in our
          database, and can be changed at any time on the <Link href="/account">account page</Link>.
          The application does not copy your subscription state into a Brevo marketing contact list.
        </p>

        <h2>Video and other processors</h2>
        <p>
          The application uses Neon for its database, its deployment provider for hosting, Brevo for
          transactional email, YouTube for embedded source footage, and Cloudinary for short
          rights-cleared excerpts hosted by the Board. A screening page loads its video immediately
          and attempts muted playback so the evidence is the first thing you encounter. This means
          YouTube or Cloudinary can receive ordinary network and playback-request information as soon
          as you open a video page, without waiting for a player click. That information can include
          the IP address, browser headers, requested media range, and time of access, and is handled
          under the provider&apos;s own privacy terms. These providers may process information in
          other countries subject to their contractual safeguards and applicable law.
        </p>

        <h2>Retention and the permanent ballot record</h2>
        <p>
          Account details remain while the account is active. Sessions expire and are revoked on
          sign-out, password reset, restriction, or anonymization as applicable. A daily cleanup
          removes expired application sessions and verification records, rate-limit buckets after
          24 hours, and unfinished watch sessions seven days after expiry. Hosting, email, and video
          provider logs follow the provider retention terms described in their own notices.
        </p>
        <p>
          Evidence submissions and their private moderation history are retained while the lead is
          being investigated and afterwards as needed to document acceptance, refusal, duplication,
          abuse, or a resulting archive record. Do not include unrelated personal information in a
          claim or source. You may use the privacy contact below to ask about a submission; include
          its <code>SUB-</code> reference so it can be located without repeating the evidence.
        </p>
        <p>
          Qualified watch receipts, submitted rulings, ballot exclusions, and moderation audit
          entries are append-only records. They are retained for the life of the public ledger
          because deleting or rewriting them would make the tally unauditable. After account
          anonymization, any previously counted ballots are excluded from the public aggregate.
          Their original values and the exclusion events remain connected only to an opaque,
          non-public account identifier—not to your former name, email, password, or active session.
        </p>

        <h2>Your choices</h2>
        <p>
          You may update the optional email preference or anonymize your account from{" "}
          <Link href="/account">your account</Link>. Anonymization is irreversible: it removes or
          replaces direct account identifiers, destroys sign-in credentials and sessions, and ends
          email updates. Previously counted ballots stop contributing to public scores, while the
          immutable ballots and their exclusion events remain for integrity. You may also ask for
          access, correction, or help exercising an applicable data right through the privacy contact
          below. We may need to verify that the request belongs to you.
        </p>

        <h2>Contact</h2>
        {PRIVACY_EMAIL ? (
          <p>
            Send privacy and account-data requests to{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. Please do not send a password,
            session token, or government identity document unless we specifically request a secure
            verification method.
          </p>
        ) : (
          <div className="provisional">
            <span className="lbl">Pre-launch contact</span>
            <p>
              A public privacy inbox has not yet been configured. Signed-in testers can use the
              account anonymization control directly. For any other private request, contact the
              person who invited you to this test. The evidence form asks only for a contact email;
              do not place unrelated personal information in its claim or source fields. The
              operator must configure and publish a monitored privacy address before opening
              general registration.
            </p>
          </div>
        )}

        <h2>Changes to this notice</h2>
        <p>
          Material changes will be dated here and, when they affect registered members, announced
          through the service or by account email. This notice should be read with the{" "}
          <Link href="/terms">Terms of use</Link> and <Link href="/rules">Rules of the Committee</Link>.
        </p>
      </article>
    </SiteFrame>
  );
}
