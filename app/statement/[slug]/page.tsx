import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/SiteFrame";
import Guilloche from "@/components/Guilloche";
import StatementVotingPanel from "@/components/StatementVotingPanel";
import Medal from "@/components/Medal";
import EntryTitle from "@/components/EntryTitle";
import StatementFooterNav from "@/components/StatementFooterNav";
import { getData } from "@/lib/data";
import { tierOf } from "@/lib/tiers";
import type { Axes } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const data = await getData();
  const s = data.statementBySlug((await params).slug);
  if (!s) return { title: "Entry not found" };
  const neta = data.netaBySlug(s.neta);
  const title = s.hasVerbatimQuote ? `“${s.quote}”` : s.neutralTitle;
  return {
    title,
    description: `${neta?.name ?? "Unknown"} · ${s.venue}, ${s.daysAgo} days ago. Indexed by the Bhashan Board.`,
    robots: s.publicationEligible
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: { title, description: `${neta?.name} · ${s.venue}` },
  };
}

const AXIS_LABELS: [keyof Axes, string][] = [
  ["logic", "Logic damage"],
  ["straightFace", "Straight face"],
  ["rewatch", "Rewatch value"],
  ["crowd", "Crowd complicity"],
  ["consequence", "Consequence"],
];

export default async function StatementPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getData();
  const s = data.statementBySlug((await params).slug);
  if (!s) notFound();

  const neta = data.netaBySlug(s.neta);
  const party = data.partyByCode(s.partyAtTime);
  const tier = tierOf(s.gp);
  const rank = s.held ? null : data.rankOf(s.slug);

  return (
    <SiteFrame>
      <div className="certificate">
        <Guilloche variant="frame" />
        <div className="cert-inner">
          <div className="cert-top">
            <div>
              <div className="cert-serial">Entry No. {s.corpusId}</div>
              <div className="lbl" style={{ marginTop: 3 }}>
                {s.held
                  ? `Indexed · held for ${s.held === "review" ? "Committee review" : "parity"}`
                  : "Indexed · placed on the seed ladder"}
              </div>
            </div>
            <div style={{ color: s.held ? "var(--ink-25)" : "var(--foil)", textAlign: "center" }}>
              <svg className="medal" style={{ width: 54, height: 54, margin: "0 auto" }} aria-hidden="true">
                <use href="#g-seal" />
              </svg>
              <div className="lbl" style={{ color: "inherit", marginTop: 3 }}>
                {s.held ? "Not placed" : tier.name}
              </div>
            </div>
          </div>

          {/* The honest state of the record, stated before anything else.
              Claiming ratification over unverified material would be the
              same failure as inventing a quote. */}
          {!s.publicationEligible && (
            <div className="provisional">
              <span className="lbl">Not yet verified for publication</span>
              <p>
                {s.verificationStage === "text_sourced" ? (
                  <>This entry is <strong>text-sourced</strong>: a named representative, a reported remark,
                  and at least one attributable outlet. It is not published. Publication and voting require
                  a bounded Tier A or B video excerpt, transcript, context review, and human sign-off.</>
                ) : s.verificationStage === "av_verified" ? (
                  <>A bounded source excerpt is attached, but the entry still awaits transcript, context,
                  subtitle, and human review. It cannot receive public rulings until the Committee signs off.</>
                ) : (
                  <>This entry is marked committee-passed but does not satisfy the complete publication bar.
                  It remains provisional and cannot receive public rulings until its status, original wording,
                  translation, context, source tier, and bounded video evidence all pass validation.</>
                )}
              </p>
              {s.needs.length > 0 && (
                <ul className="needs">
                  {s.needs.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <h1 className="cert-title">
            <EntryTitle statement={s} />
          </h1>

          {s.hasVerbatimQuote && s.language !== "English" && s.quoteTranslation && (
            <p className="quote-translation">
              <span className="lbl">English translation</span>
              {s.quoteTranslation}
            </p>
          )}

          {!s.hasVerbatimQuote && (
            <p className="quote-note">
              The exact wording of this remark has not been established. The line above is a neutral
              subject heading written by the Committee, not a quotation. It will be replaced by the
              representative&rsquo;s own words, or the entry will be withdrawn.
            </p>
          )}
          {s.quoteNote && s.hasVerbatimQuote && <p className="quote-note">{s.quoteNote}</p>}

          <p className="cert-attrib">
            {neta ? <Link href={`/neta/${neta.slug}`}>{neta.name}</Link> : "Unknown"}
            {s.office && ` · ${s.office}`}
            {party && ` · ${party.name}`} · {s.venue}
          </p>

          <StatementVotingPanel
            key={s.corpusId}
            statementId={s.corpusId}
            video={s.video}
            publicationEligible={s.publicationEligible}
            initialRating={{
              gp: s.gp,
              performance: s.rating.performance,
              validVoteCount: s.rating.validVoteCount,
              distribution: s.rating.distribution,
            }}
          />

          <div className="verdict">
            <div>
              <span className="lbl">{s.rating.source === "community" ? "Public GP" : "Seed GP"}</span>
              <b>{s.held ? "—" : s.gp.toLocaleString("en-IN")}</b>
            </div>
            <div>
              <span className="lbl">Public rulings</span>
              <b>{s.rating.validVoteCount.toLocaleString("en-IN")}</b>
            </div>
            <div>
              <span className="lbl">Ladder rank</span>
              <b>{rank ? `#${rank}` : "—"}</b>
            </div>
            <div>
              <span className="lbl">Source tier</span>
              <b>{s.bestSourceTier}</b>
            </div>
            <div>
              <span className="lbl">Category</span>
              <b style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>{s.category}</b>
            </div>
            <div>
              <span className="lbl">Tier</span>
              <div className="tier-line" style={{ color: s.held ? "var(--ink-45)" : tier.colour }}>
                {!s.held && <Medal tier={tier.key} title={false} />}
                <span>{s.held ? "Not placed" : tier.name}</span>
              </div>
            </div>
          </div>

          <div className="claim-block">
            <span className="lbl">The indexed claim</span>
            <p>{s.claim}</p>
          </div>

          {s.counterpoint && (
            <div className="counterpoint">
              <span className="lbl">Counterpoint</span>
              <p>{s.counterpoint}</p>
            </div>
          )}

          {s.contextNote && (
            <div className="committee-note">
              <span className="lbl">Context</span>
              <p>{s.contextNote}</p>
            </div>
          )}

          {s.policyNote && (
            <div className="erratum">
              <span className="lbl">Ruling on scope</span>
              <p>{s.policyNote}</p>
            </div>
          )}

          <div className="sources-block">
            <span className="lbl">Sources &mdash; go and check</span>
            <ul className="sources-list">
              {s.sources.map((src, i) => (
                <li key={`${src.outlet}-${i}`}>
                  <span className={`tierpip tier-${src.tier}`}>{src.tier}</span>
                  {src.url && src.url !== "#" ? (
                    <a href={src.url} target="_blank" rel="noopener noreferrer">
                      {src.outlet}
                    </a>
                  ) : (
                    <span>{src.outlet}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="stamps">
            <span className="stamp foil">Certified organic gyan &middot; no AI</span>
            <span className={`stamp${s.bestSourceTier === "A" ? " green" : ""}`}>
              Best source &middot; Tier {s.bestSourceTier}
            </span>
          </div>

          {!s.held && (
            <div className="axes">
              <div className="lbl" style={{ marginBottom: 8 }}>
                Editorial seed axes &middot; frozen when public voting begins
              </div>
              {AXIS_LABELS.map(([key, label]) => (
                <div className="axis" key={key}>
                  <span>{label}</span>
                  <div className="bar">
                    <i style={{ width: `${s.axes[key]}%` }} />
                  </div>
                  <span className="val">{String(Math.round(s.axes[key] / 20))}</span>
                </div>
              ))}
              <p style={{ fontSize: 13, color: "var(--ink-45)", margin: "10px 0 0" }}>
                The Committee scores each axis 0&ndash;5 to establish a transparent prior. Verified public
                rulings then move the live performance score; consequence is inverted, so 5 means nothing
                happened, or a promotion followed.
              </p>
            </div>
          )}
        </div>
      </div>

      {!s.held && <StatementFooterNav slug={s.slug} />}
    </SiteFrame>
  );
}
