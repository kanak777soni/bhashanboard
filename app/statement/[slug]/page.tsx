import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EntryTitle from "@/components/EntryTitle";
import Guilloche from "@/components/Guilloche";
import Medal from "@/components/Medal";
import ScreeningFrame from "@/components/ScreeningFrame";
import StatementFooterNav from "@/components/StatementFooterNav";
import StatementVotingPanel from "@/components/StatementVotingPanel";
import { cloudinaryVideoUrl } from "@/lib/cloudinary";
import { getData } from "@/lib/data";
import {
  ratingMaturityLabel,
  statementRatingMaturity,
} from "@/lib/public-inventory";
import { tierOf } from "@/lib/tiers";
import type { Axes, VerificationStage } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const data = await getData();
  const statement = data.statementBySlug((await params).slug);
  if (!statement) return { title: "Entry not found" };

  const neta = data.netaBySlug(statement.neta);
  const title = statement.hasVerbatimQuote
    ? `“${statement.quote}”`
    : statement.neutralTitle;
  const description = `${neta?.name ?? "Unknown"} · ${statement.venue}, ${statement.daysAgo} days ago. Indexed by the Bhashan Board.`;

  return {
    title,
    description,
    robots: statement.publicationEligible
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title,
      description: `${neta?.name ?? "Unknown"} · ${statement.venue}`,
    },
  };
}

const AXIS_LABELS: [keyof Axes, string][] = [
  ["logic", "Logic damage"],
  ["straightFace", "Straight face"],
  ["rewatch", "Rewatch value"],
  ["crowd", "Crowd complicity"],
  ["consequence", "Consequence"],
];

function evidenceStateLabel({
  hasVideo,
  publicationEligible,
  maturity,
}: {
  hasVideo: boolean;
  publicationEligible: boolean;
  maturity: ReturnType<typeof statementRatingMaturity>;
}) {
  if (!hasVideo) return "Awaiting verified footage";
  if (publicationEligible) return ratingMaturityLabel(maturity);
  return "Evidence under review";
}

function ProvisionalNotice({
  stage,
  needs,
}: {
  stage: VerificationStage;
  needs: string[];
}) {
  return (
    <aside className="provisional statement-review-notice">
      <span className="lbl">Not yet verified for publication</span>
      <p>
        {stage === "text_sourced" ? (
          <>
            This entry is <strong>text-sourced</strong>: a named
            representative, a reported remark, and at least one attributable
            outlet. Publication and voting still require a bounded Tier A or B
            video excerpt, original-language wording, context review, and human
            sign-off.
          </>
        ) : stage === "av_verified" ? (
          <>
            A bounded source excerpt is attached, but the wording, context,
            source record, or human review is not complete. It cannot receive
            public rulings until the Committee signs off.
          </>
        ) : (
          <>
            This entry is marked committee-passed but does not satisfy the
            complete publication bar. It remains provisional until its status,
            original wording, translation, context, source tier, and bounded
            video evidence all pass validation.
          </>
        )}
      </p>
      {needs.length > 0 && (
        <ul className="needs">
          {needs.map((need) => (
            <li key={need}>{need}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export default async function StatementPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const data = await getData();
  const statement = data.statementBySlug((await params).slug);
  if (!statement) notFound();

  const neta = data.netaBySlug(statement.neta);
  const party = data.partyByCode(statement.partyAtTime);
  const video = statement.video;
  const hasVideo = video !== undefined;
  const maturity = statementRatingMaturity(statement);
  const isLiveScreening = statement.publicationEligible && hasVideo;
  const isRanked = isLiveScreening && maturity === "ranked";
  const tier = tierOf(statement.gp);
  const rank = isRanked ? data.publicRankOf(statement.slug) : null;
  const evidenceState = evidenceStateLabel({
    hasVideo,
    publicationEligible: statement.publicationEligible,
    maturity,
  });

  let hostedVideoUrl: string | undefined;
  if (video?.platform === "cloudinary") {
    try {
      // Authenticated Cloudinary media has no unsigned public URL. Generate
      // the signed, versioned MP4 derivative only on the server.
      hostedVideoUrl = cloudinaryVideoUrl(video);
    } catch (error) {
      // A configuration fault must not hide the underlying research record.
      console.error("Cloudinary playback URL generation failed", {
        statementId: statement.corpusId,
        error: String(error),
      });
    }
  }

  const statementIntro = (
    <section className="statement-intro">
      <span className="lbl">
        {hasVideo ? "Statement on screen" : "Research file"}
      </span>
      <h1 className="cert-title">
        <EntryTitle statement={statement} />
      </h1>
      <p className="cert-attrib">
        {neta ? (
          <Link href={`/neta/${neta.slug}`}>{neta.name}</Link>
        ) : (
          "Unknown"
        )}
        {statement.office && ` · ${statement.office}`}
        {party && ` · ${party.name}`} · {statement.venue}
      </p>
    </section>
  );

  return (
    <ScreeningFrame>
      <article
        className={`certificate statement-certificate ${
          hasVideo ? "statement-has-video" : "statement-research-file"
        }`}
      >
        <Guilloche variant="frame" />
        <div className="cert-inner">
          <header className="cert-top statement-file-head">
            <div>
              <div className="cert-serial">
                Entry No. {statement.corpusId}
              </div>
              <div className="lbl statement-evidence-state">
                {evidenceState}
              </div>
            </div>

            {isRanked ? (
              <div
                className="statement-placement-seal"
                style={{ color: tier.colour, textAlign: "center" }}
              >
                <svg
                  className="medal"
                  style={{ width: 54, height: 54, margin: "0 auto" }}
                  aria-hidden="true"
                >
                  <use href="#g-seal" />
                </svg>
                <div className="lbl" style={{ color: "inherit", marginTop: 3 }}>
                  {tier.name}
                </div>
              </div>
            ) : (
              <div className="statement-file-mark" aria-label={evidenceState}>
                <span className="lbl">
                  {isLiveScreening
                    ? "Live screening"
                    : hasVideo
                      ? "Committee review"
                      : "Research file"}
                </span>
                <strong>
                  {isLiveScreening
                    ? evidenceState
                    : hasVideo
                      ? "Screening pending"
                      : "Footage wanted"}
                </strong>
              </div>
            )}
          </header>

          {video ? (
            <>
              <section
                className="statement-screening"
                aria-label="Verified footage and public ruling"
              >
                <StatementVotingPanel
                  key={statement.corpusId}
                  statementId={statement.corpusId}
                  video={video}
                  videoUrl={hostedVideoUrl}
                  publicationEligible={statement.publicationEligible}
                  initialRating={{
                    gp: statement.gp,
                    performance: statement.rating.performance,
                    validVoteCount: statement.rating.validVoteCount,
                    distribution: statement.rating.distribution,
                  }}
                />
              </section>

              {statementIntro}

              {!statement.publicationEligible && (
                <ProvisionalNotice
                  stage={statement.verificationStage}
                  needs={statement.needs}
                />
              )}
            </>
          ) : (
            <>
              {statementIntro}
              <section
                className="research-file-notice"
                aria-labelledby={`research-file-${statement.corpusId}`}
              >
                <span className="lbl">Research file · awaiting footage</span>
                <h2 id={`research-file-${statement.corpusId}`}>
                  This record is documented, but it is not a screening yet.
                </h2>
                <p>
                  No verified video excerpt is attached. The statement therefore
                  carries no public rank, medal, GP score, or ballot. The sourced
                  record remains available while the Committee looks for the
                  original footage and enough surrounding context to review it
                  honestly.
                </p>
                {statement.needs.length > 0 && (
                  <ul className="needs">
                    {statement.needs.map((need) => (
                      <li key={need}>{need}</li>
                    ))}
                  </ul>
                )}
                <Link href="/submit" className="btn ghost research-file-submit">
                  Submit better evidence
                </Link>
              </section>
            </>
          )}

          {statement.hasVerbatimQuote &&
            statement.language !== "English" &&
            statement.quoteTranslation && (
              <p className="quote-translation statement-translation">
                <span className="lbl">English translation</span>
                {statement.quoteTranslation}
              </p>
            )}

          {!statement.hasVerbatimQuote && (
            <p className="quote-note">
              The exact wording of this remark has not been established. The
              subject heading above was written by the Committee and is not a
              quotation. It will be replaced by the representative&rsquo;s own
              words, or the entry will be withdrawn.
            </p>
          )}
          {statement.quoteNote && statement.hasVerbatimQuote && (
            <p className="quote-note">{statement.quoteNote}</p>
          )}

          {isRanked ? (
            <div className="verdict statement-verdict">
              <div>
                <span className="lbl">Public GP</span>
                <b>{statement.gp.toLocaleString("en-IN")}</b>
              </div>
              <div>
                <span className="lbl">Public rulings</span>
                <b>
                  {statement.rating.validVoteCount.toLocaleString("en-IN")}
                </b>
              </div>
              <div>
                <span className="lbl">Ladder rank</span>
                <b>{rank ? `#${rank}` : "—"}</b>
              </div>
              <div>
                <span className="lbl">Source tier</span>
                <b>{statement.bestSourceTier}</b>
              </div>
              <div>
                <span className="lbl">Category</span>
                <b
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 17,
                  }}
                >
                  {statement.category}
                </b>
              </div>
              <div>
                <span className="lbl">Tier</span>
                <div className="tier-line" style={{ color: tier.colour }}>
                  <Medal tier={tier.key} title={false} />
                  <span>{tier.name}</span>
                </div>
              </div>
            </div>
          ) : (
            <dl className="statement-record-facts record-state">
              <div>
                <dt className="lbl">Evidence state</dt>
                <dd>{evidenceState}</dd>
              </div>
              <div>
                <dt className="lbl">Source tier</dt>
                <dd>Tier {statement.bestSourceTier}</dd>
              </div>
              <div>
                <dt className="lbl">Category</dt>
                <dd>{statement.category}</dd>
              </div>
              <div>
                <dt className="lbl">Original language</dt>
                <dd>{statement.language}</dd>
              </div>
            </dl>
          )}

          <div className="claim-block">
            <span className="lbl">The indexed claim</span>
            <p>{statement.claim}</p>
          </div>

          {(statement.counterpoint ||
            statement.contextNote ||
            statement.policyNote) && (
            <details
              className="statement-disclosure statement-context-disclosure"
              open={!hasVideo}
            >
              <summary>
                <span className="lbl">Context &amp; scope</span>
                <span className="statement-disclosure-prompt">
                  Read the surrounding record
                </span>
              </summary>
              <div className="statement-disclosure-body">
                {statement.counterpoint && (
                  <div className="counterpoint">
                    <span className="lbl">Counterpoint</span>
                    <p>{statement.counterpoint}</p>
                  </div>
                )}

                {statement.contextNote && (
                  <div className="committee-note">
                    <span className="lbl">Context</span>
                    <p>{statement.contextNote}</p>
                  </div>
                )}

                {statement.policyNote && (
                  <div className="erratum">
                    <span className="lbl">Ruling on scope</span>
                    <p>{statement.policyNote}</p>
                  </div>
                )}
              </div>
            </details>
          )}

          <details
            className="statement-disclosure statement-sources-disclosure"
            open={!hasVideo}
          >
            <summary>
              <span className="lbl">Sources</span>
              <span className="statement-disclosure-prompt">
                {statement.sources.length} recorded · go and check
              </span>
            </summary>
            <div className="sources-block statement-sources">
              <ul className="sources-list">
                {statement.sources.map((source, index) => (
                  <li key={`${source.outlet}-${index}`}>
                    <span className={`tierpip tier-${source.tier}`}>
                      {source.tier}
                    </span>
                    {source.url && source.url !== "#" ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.outlet}
                      </a>
                    ) : (
                      <span>{source.outlet}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </details>

          <div className="stamps statement-stamps">
            {isRanked ? (
              <span className="stamp foil">
                Certified organic gyan &middot; no AI
              </span>
            ) : (
              <span className="stamp foil">
                {hasVideo
                  ? "Evidence attached · review pending"
                  : "Research in progress · footage wanted"}
              </span>
            )}
            <span
              className={`stamp${
                statement.bestSourceTier === "A" ? " green" : ""
              }`}
            >
              Best source &middot; Tier {statement.bestSourceTier}
            </span>
          </div>

          {isRanked && (
            <div className="axes">
              <div className="lbl" style={{ marginBottom: 8 }}>
                Editorial seed axes &middot; frozen when public voting begins
              </div>
              {AXIS_LABELS.map(([key, label]) => (
                <div className="axis" key={key}>
                  <span>{label}</span>
                  <div className="bar">
                    <i style={{ width: `${statement.axes[key]}%` }} />
                  </div>
                  <span className="val">
                    {String(Math.round(statement.axes[key] / 20))}
                  </span>
                </div>
              ))}
              <p
                style={{
                  fontSize: 13,
                  color: "var(--ink-45)",
                  margin: "10px 0 0",
                }}
              >
                The Committee scores each axis 0&ndash;5 to establish a
                transparent prior. Verified public rulings then move the live
                performance score; consequence is inverted, so 5 means nothing
                happened, or a promotion followed.
              </p>
            </div>
          )}
        </div>
      </article>

      {isRanked ? (
        <StatementFooterNav slug={statement.slug} />
      ) : (
        <nav className="statement-file-nav" aria-label="Research file actions">
          <Link href="/record" className="btn ghost">
            Return to the Record
          </Link>
          {!hasVideo ? (
            <Link href="/submit" className="btn seal">
              Submit footage
            </Link>
          ) : (
            <Link href="/watch" className="btn seal">
              Watch live screenings
            </Link>
          )}
        </nav>
      )}
    </ScreeningFrame>
  );
}
