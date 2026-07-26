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
            <strong>Equal opportunity.</strong> Party balance is enforced in the queue, published on the
            homepage, and audited monthly.
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
          Ratings are produced by pairwise comparison, not by a score assigned to an entry in isolation.
          A rater is shown two entries and answers one question: which is more magnificent? Ratings
          update by Elo. The formula is published because a mechanical, auditable rule is the point.
        </p>
        <p>
          Every entry begins at 1,500 points and is unranked until it has completed twenty placement
          duels. Matchups are never chooseable — the server selects them, pairing entries of similar
          rating and, wherever possible, from different parties.
        </p>
        <p>
          Raters may optionally tag <em>why</em> across five axes: logic damage, straight face, rewatch
          value, crowd complicity, and consequence. These tags do not affect the rating. They drive
          categories, honorifics and the public record.
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
          venue, an accurate transcript and translation, the surrounding sixty seconds of context, and a
          human review against these rules. Roughly a third of submissions are rejected at that stage.
          That is the system working.
        </p>
      </div>
    </SiteFrame>
  );
}
