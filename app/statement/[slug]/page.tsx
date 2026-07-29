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
import { statementRatingMaturity } from "@/lib/public-inventory";
import { tierOf } from "@/lib/tiers";

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
  const metadataDetails = [
    neta?.name ?? "Unknown",
    statement.venue,
    statement.eventDate,
  ].filter(Boolean);
  const description = `${metadataDetails.join(" · ")}. Watch and score this clip on The Bhashan Board.`;

  return {
    title,
    description,
    robots: statement.publicationEligible
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title,
      description: metadataDetails.join(" · "),
    },
  };
}

function evidenceStateLabel({
  hasVideo,
  publicationEligible,
  maturity,
}: {
  hasVideo: boolean;
  publicationEligible: boolean;
  maturity: ReturnType<typeof statementRatingMaturity>;
}) {
  if (!hasVideo) return "Clip wanted";
  if (publicationEligible) {
    return maturity === "new"
      ? "Fresh clip"
      : maturity === "placement"
        ? "Finding its place"
        : "Ranked";
  }
  return "Clip on deck";
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
  if (isLiveScreening && video?.platform === "cloudinary") {
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
        {isLiveScreening ? "Now playing" : "In the archive"}
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
        {[statement.office, party?.name, statement.venue]
          .filter(Boolean)
          .map((detail) => (
            <span key={detail}> · {detail}</span>
          ))}
      </p>
    </section>
  );

  return (
    <ScreeningFrame>
      <article
        className={`certificate statement-certificate ${
          isLiveScreening ? "statement-has-video" : "statement-research-file"
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
                    ? "Live clip"
                    : hasVideo
                      ? "Backstage"
                      : "In the archive"}
                </span>
                <strong>
                  {isLiveScreening
                    ? evidenceState
                    : hasVideo
                      ? "Clip on deck"
                      : "Clip wanted"}
                </strong>
              </div>
            )}
          </header>

          {isLiveScreening && video ? (
            <>
              <section
                className="statement-screening"
                aria-label="Video and public vote"
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
            </>
          ) : (
            <>
              {statementIntro}
              <section
                className="research-file-notice"
                aria-labelledby={`research-file-${statement.corpusId}`}
              >
                <span className="lbl">
                  {hasVideo
                    ? "Clip added · not live yet"
                    : "Clip wanted"}
                </span>
                <h2 id={`research-file-${statement.corpusId}`}>
                  {hasVideo
                    ? "This one is waiting backstage."
                    : "This statement still needs its video."}
                </h2>
                {hasVideo ? (
                  <p>
                    The clip has been added but is not live on Watch yet. Once
                    it is published, the player, vote bar and GP will appear
                    right here.
                  </p>
                ) : (
                  <p>
                    Know where the original clip lives? Send the link. Until a
                    video goes live, this entry stays off the vote and the
                    standings.
                  </p>
                )}
                <Link href="/submit" className="btn ghost research-file-submit">
                  {hasVideo ? "Send another clip" : "Send the clip"}
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
              The original wording is not available yet, so the heading above
              is a subject line, not a quotation.
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
                <span className="lbl">Votes</span>
                <b>
                  {statement.rating.validVoteCount.toLocaleString("en-IN")}
                </b>
              </div>
              <div>
                <span className="lbl">Standings</span>
                <b>{rank ? `#${rank}` : "—"}</b>
              </div>
              <div>
                <span className="lbl">Sarcasm score</span>
                <b>{Math.round(statement.rating.performance)}/100</b>
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
                <span className="lbl">Class</span>
                <div className="tier-line" style={{ color: tier.colour }}>
                  <Medal tier={tier.key} title={false} />
                  <span>{tier.name}</span>
                </div>
              </div>
            </div>
          ) : (
            <dl className="statement-record-facts record-state">
              <div>
                <dt className="lbl">Video</dt>
                <dd>{isLiveScreening ? "Live" : hasVideo ? "On deck" : "Wanted"}</dd>
              </div>
              <div>
                <dt className="lbl">Board status</dt>
                <dd>{isLiveScreening ? "Voting open" : "Not live yet"}</dd>
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

          {(statement.claim ||
            statement.counterpoint ||
            statement.contextNote ||
            statement.policyNote) && (
            <details
              className="statement-disclosure statement-context-disclosure"
            >
              <summary>
                <span className="lbl">More about this clip</span>
                <span className="statement-disclosure-prompt">
                  Context, claim and notes
                </span>
              </summary>
              <div className="statement-disclosure-body">
                {statement.claim && (
                  <div className="claim-block">
                    <span className="lbl">What this is about</span>
                    <p>{statement.claim}</p>
                  </div>
                )}

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
                    <span className="lbl">Scope note</span>
                    <p>{statement.policyNote}</p>
                  </div>
                )}
              </div>
            </details>
          )}

          {statement.sources.length > 0 && (
            <details
              className="statement-disclosure statement-sources-disclosure"
            >
              <summary>
                <span className="lbl">Sources &amp; receipts</span>
                <span className="statement-disclosure-prompt">
                  {statement.sources.length}{" "}
                  {statement.sources.length === 1 ? "link" : "links"}
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
          )}

          <div className="stamps statement-stamps">
            {isRanked ? (
              <span className="stamp foil">
                Certified organic gyan &middot; no AI
              </span>
            ) : (
              <span className="stamp foil">
                {isLiveScreening
                  ? "Live clip · voting open"
                  : hasVideo
                    ? "Clip added · backstage"
                    : "Clip wanted"}
              </span>
            )}
          </div>

        </div>
      </article>

      {isRanked ? (
        <StatementFooterNav slug={statement.slug} />
      ) : (
        <nav className="statement-file-nav" aria-label="Clip actions">
          <Link href={isLiveScreening ? "/watch" : "/record"} className="btn ghost">
            {isLiveScreening ? "Back to Watch" : "Browse the archive"}
          </Link>
          {isLiveScreening ? (
            <Link href="/standings" className="btn seal">
              See the Standings
            </Link>
          ) : !hasVideo ? (
            <Link href="/submit" className="btn seal">
              Send the clip
            </Link>
          ) : (
            <Link href="/watch" className="btn seal">
              Watch live clips
            </Link>
          )}
        </nav>
      )}
    </ScreeningFrame>
  );
}
