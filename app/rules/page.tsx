import type { Metadata } from "next";
import SiteFrame from "@/components/SiteFrame";

export const metadata: Metadata = {
  title: "The Rules of the Committee",
  description: "What we index, what we refuse, and the published rubric by which entries are rated.",
};

export default function RulesPage() {
  return (
    <SiteFrame>
      <div className="document">
        <h1 className="page-title">The Rules of the Committee</h1>
        <p style={{ fontStyle: "italic", color: "var(--ink-70)", fontSize: 18 }}>
          We rank arguments, not accents.
        </p>

        <ol>
          <li>
            <strong>Claims and reasoning only.</strong> We index what a representative asserted or
            reasoned. We never index a stammer, a slip of the tongue, a mispronunciation, an accent, or
            an English-fluency error.
          </li>
          <li>
            <strong>Nothing personal.</strong> No family, no health, no appearance, no private life, no
            religion, no caste, no community.
          </li>
          <li>
            <strong>Never synthetic.</strong> No AI generation, no dubbing, no re-enactment, no
            impersonation, no speed or pitch edits. Ever.
          </li>
          <li>
            <strong>Public figures, public functions.</strong> Only elected representatives, candidates,
            office-bearers and ministers — speaking publicly, in their public role.
          </li>
          <li>
            <strong>Full context, always.</strong> Source link, date, venue, full transcript, and the
            surrounding minute.
          </li>
          <li>
            <strong>Equal evidentiary standard.</strong> The same source, context, and publication
            tests apply regardless of party. Coverage imbalance is published and corrected by
            researching under-covered parties&mdash;never by hiding entries or changing scores.
          </li>
          <li>
            <strong>Right of reply.</strong> Any verified office may respond. Their response is pinned to
            the entry, permanently, unedited.
          </li>
          <li>
            <strong>We keep score of ourselves.</strong> Every removal, correction and
            re-contextualisation is logged publicly, forever.
          </li>
        </ol>

        <h2>The rating rubric</h2>
        <p>
          The official ballot belongs to one statement. A verified member must watch at least 90% of its
          bounded source excerpt, in a visible tab and through the end, before choosing one of five fixed
          positions: Flat (0), Wry (25), Sharp (50), Savage (75), or Historic (100). One account may enter
          one final ruling per statement. It cannot be edited or submitted twice.
        </p>
        <p>
          Every valid public ballot has equal strength: one ballot, one value. There are no secret party,
          subscription, editorial, or popularity multipliers. If <em>n</em> is the number of valid public
          rulings and <em>s</em> is their sum, performance is simply <code>s / n</code>. GP is{" "}
          <code>round(1000 + 10 × performance)</code>.
        </p>
        <p>
          A statement stays in placement and receives no public rank until ten valid rulings have been
          recorded. Raw ballots, watch receipts, and exclusions are immutable. An administrator may exclude
          a ballot for documented abuse, but cannot rewrite it, and the action remains in the audit record.
          The performance bar, vote count, distribution, GP and rank come only from valid public ballots.
        </p>
        <p>
          The five editorial axes—logic damage, straight face, rewatch value, crowd complicity, and
          consequence—remain internal research notes and never alter the public score. Aamne-Saamne remains
          a playful, non-scoring exhibition; picks made there never alter the ladder.
        </p>

        <h2>What a tier means</h2>
        <p>
          A tier attaches to <strong>a statement</strong>, never to a person. The Committee has no view
          on any representative. It has a view on twenty seconds of video, and it has published the
          video.
        </p>

        <h2>How an entry is verified before publication</h2>
        <p>
          No entry is published without at least one primary or broadcast source, a confirmed date and
          venue, an accurate original-language verbatim excerpt and translation where needed, recorded
          surrounding context, and a human review against these rules. Roughly a third of submissions
          are rejected at that stage. That is the system working.
        </p>
      </div>
    </SiteFrame>
  );
}
