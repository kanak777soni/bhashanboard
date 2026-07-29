import type { Metadata } from "next";
import SiteFrame from "@/components/SiteFrame";

export const metadata: Metadata = {
  title: "The Rules of the Board",
  description: "What belongs on the Board and exactly how public votes become GP.",
};

export default function RulesPage() {
  return (
    <SiteFrame>
      <div className="document">
        <h1 className="page-title">The Rules of the Board</h1>
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
            <strong>The clip must stand on its own.</strong> Every live card has
            a bounded playable video, the original-language quote, and an
            English translation when needed. Date, venue, links and surrounding
            context are shown when known; we never invent missing details.
          </li>
          <li>
            <strong>One publishing bar for every party.</strong> The same clip
            and card essentials apply to everyone. Coverage balance is improved
            by adding material&mdash;never by hiding clips or changing scores.
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
          clip, in a visible tab and through the end, before choosing one of five fixed
          positions: Flat (0), Wry (25), Sharp (50), Savage (75), or Historic (100). One account may enter
          one final vote per statement. It cannot be edited or submitted twice.
        </p>
        <p>
          Every valid public ballot has equal strength: one ballot, one value. There are no secret party,
          subscription, editorial, or popularity multipliers. If <em>n</em> is the number of valid public
          votes and <em>s</em> is their sum, performance is simply <code>s / n</code>. GP is{" "}
          <code>round(1000 + 10 × performance)</code>.
        </p>
        <p>
          A statement stays in placement and receives no public rank until ten valid votes have been
          recorded. Raw ballots, watch receipts, and exclusions are immutable. An administrator may exclude
          a ballot for documented abuse, but cannot rewrite it, and the action remains in the audit record.
          The performance bar, vote count, distribution, GP and rank come only from valid public ballots.
        </p>
        <p>
          The five editorial axes—Logic Break, Straight-Face Delivery, Replay
          Value, Crowd Complicity, and No Consequence—appear publicly as the
          Sarcasm Profile. They describe the comic anatomy of the moment but
          never alter GP, class or rank. Aamne-Saamne remains a playful,
          non-scoring exhibition; picks made there never alter the standings.
        </p>

        <h2>What a class means</h2>
        <p>
          A class attaches to <strong>a statement</strong>, never to a person.
          The Board scores one public moment, not somebody&rsquo;s entire
          career or character.
        </p>

        <h2>How the Hall of Fame works</h2>
        <p>
          Kohinoor Class is conferred automatically by the public score. The
          Hall of Fame is a separate permanent honour. A clip becomes eligible
          for formal induction only after reaching at least 1,875 GP and 25
          valid public votes. Induction never changes its score, class or rank.
        </p>

        <h2>How a clip goes live</h2>
        <p>
          An administrator adds a playable YouTube excerpt or a
          rights-confirmed Cloudinary upload, then completes the card title,
          speaker, party, category, original quote and translation where
          needed. The YouTube player and timestamps are checked automatically.
          The administrator previews the finished card and explicitly chooses
          <strong> Go live</strong>. Extra links and background remain optional
          and can be added whenever they improve the joke without distorting it.
        </p>
      </div>
    </SiteFrame>
  );
}
