import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "The account, source, voting, moderation, and acceptable-use terms for The Bhashan Board.",
};

export default function TermsPage() {
  return (
    <SiteFrame>
      <article className="document">
        <h1 className="page-title">Terms of use</h1>
        <p className="legal-date">Last updated 28 July 2026</p>
        <p>
          These terms govern access to The Bhashan Board, including registered accounts, watched
          source excerpts, and public rulings. By registering, you confirm that you have read and
          accept these terms and the <Link href="/privacy">Privacy notice</Link>. If you do not agree,
          do not create an account or enter a ruling.
        </p>

        <h2>What this service is</h2>
        <p>
          The Board is a sourced, satirical public-interest archive of statements made in public
          life. It uses ceremonial presentation and community rulings, but the underlying footage
          and sourcing are treated seriously. A score applies to one published statement, not to a
          person, party, community, accent, or identity. The service is not an official record,
          endorsement, election recommendation, or substitute for the complete source.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>Provide a working email address and accurate account information.</li>
          <li>Keep one personal account, protect its credentials, and do not share or sell access.</li>
          <li>
            Do not register unless you are legally able to agree to these terms. This pre-launch
            service is not offered to children.
          </li>
          <li>
            Tell us promptly if you believe the account has been compromised. We may revoke sessions,
            restrict an account, or require reverification to protect the record.
          </li>
        </ul>

        <h2>Rulings and the timed clip gate</h2>
        <p>
          A verified member must complete the timed playback gate for the bounded source excerpt
          before entering one of the five published ballot values. One account may enter one final
          ruling per statement. A submitted ruling cannot be edited, withdrawn, transferred, or
          submitted twice. Every valid public ballot has the same strength.
        </p>
        <p>
          Do not automate playback or voting, fabricate player events, coordinate duplicate accounts,
          evade a restriction, interfere with another member, or attempt to manipulate the tally. An
          administrator may exclude an abusive ballot without rewriting it; the exclusion and reason
          remain in the audit record. The full scoring method appears in the{" "}
          <Link href="/rules">Rules of the Committee</Link>.
        </p>

        <h2>Submissions and acceptable use</h2>
        <p>
          Do not submit synthetic, dubbed, deceptively edited, unlawfully obtained, private, hateful,
          harassing, or personally identifying material. Do not upload footage you do not have the
          right to provide. A source URL is a lead for human review, never an instruction to publish.
          We may reject, correct, contextualize, unpublish, or preserve a submission in the refusal or
          correction ledger.
        </p>
        <p>
          If you supply original text or metadata, you permit the Board to store, review, reproduce,
          translate, and publish it for operating and documenting the archive. You retain any rights
          you already hold. Supplying a third-party link does not grant either you or the Board
          ownership of the linked footage.
        </p>

        <h2>Sources, corrections, and replies</h2>
        <p>
          We aim to publish primary or recognized broadcast sources, bounded context, accurate
          transcripts and translations, and visible corrections. Sources can disappear, captions can
          be imperfect, and a record can change after review. Use the linked source and correction
          ledger when accuracy matters. A verified office or affected person may request a correction,
          context review, or right of reply through the correspondence process shown on the site.
        </p>

        <h2>Email</h2>
        <p>
          Account verification, recovery, security, and essential service messages are necessary to
          operate a registered account. Occasional editorial updates are optional and require a
          separate opt-in that can be withdrawn from <Link href="/account">your account</Link>.
        </p>

        <h2>Moderation, suspension, and account anonymization</h2>
        <p>
          We may restrict or suspend access when reasonably necessary to secure the service, enforce
          these terms, comply with law, or preserve an honest tally. You may irreversibly anonymize
          your account from the account page. Direct identifiers, credentials, active sessions, and
          optional email consent are removed or replaced. Previously counted ballots are excluded
          from public aggregates; the original append-only watch receipts, rulings, exclusion events,
          and audit events remain under an opaque identifier so neither a member nor an administrator
          can silently rewrite the ballot history.
        </p>

        <h2>Third-party services</h2>
        <p>
          Embedded video, linked sources, email delivery, hosting, and database infrastructure are
          supplied by independent providers with their own terms. We do not control the continuing
          availability, content, or privacy practices of an external source.
        </p>

        <h2>No promise of uninterrupted service</h2>
        <p>
          This is a pre-launch service provided on an “as available” basis. Features, entries, scores,
          and availability may change. To the extent permitted by applicable law, the operator does
          not promise uninterrupted access or accept responsibility for indirect loss caused by
          reliance on a satirical score, an unavailable third-party source, or an outage. Nothing in
          these terms excludes a right or responsibility that law does not permit us to exclude.
        </p>

        <h2>Changes and operator particulars</h2>
        <p>
          Updated terms will carry a new date, and material account changes will be announced through
          the service or by account email. The public operator identity, monitored legal/privacy
          address, grievance contact, and governing-venue particulars must be completed before this
          pre-launch build opens to general registration. Until then, access is for invited testing
          only. Privacy requests follow the process in the <Link href="/privacy">Privacy notice</Link>.
        </p>
      </article>
    </SiteFrame>
  );
}
