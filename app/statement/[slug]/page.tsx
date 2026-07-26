import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/SiteFrame";
import Guilloche from "@/components/Guilloche";
import ClipFacade from "@/components/ClipFacade";
import Medal from "@/components/Medal";
import StatementFooterNav from "@/components/StatementFooterNav";
import {
  IN_PLACEMENT,
  STATEMENTS,
  netaBySlug,
  rankOf,
  statementBySlug,
} from "@/lib/data";
import { tierByKey, tierOf } from "@/lib/tiers";
import { PLACEMENT_DUELS } from "@/lib/elo";
import type { Axes } from "@/lib/types";

export function generateStaticParams() {
  return [...STATEMENTS, ...IN_PLACEMENT].map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const s = statementBySlug((await params).slug);
  if (!s) return { title: "Entry not found" };
  const neta = netaBySlug(s.neta);
  return {
    title: `“${s.quote}”`,
    description: `${neta?.name ?? "Unknown"} · ${s.venue}. Ranked by the Bhashan Board.`,
    openGraph: { title: `“${s.quote}”`, description: `${neta?.name} · ${s.venue}` },
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
  const s = statementBySlug((await params).slug);
  if (!s) notFound();

  const neta = netaBySlug(s.neta);
  const provisional = s.placement != null;
  const tier = provisional ? tierByKey(s.projected ?? "gold") : tierOf(s.gp);
  const rank = provisional ? null : rankOf(s.slug);

  return (
    <SiteFrame>
      <div className="certificate">
        <Guilloche variant="frame" />
        <div className="cert-inner">
          <div className="cert-top">
            <div>
              <div className="cert-serial">Entry No. {String(s.id).padStart(5, "0")}</div>
              <div className="lbl" style={{ marginTop: 3 }}>
                {provisional
                  ? `Provisional — placement ${s.placement} of ${PLACEMENT_DUELS}`
                  : "Ratified by the Committee"}
              </div>
            </div>
            <div style={{ color: "var(--foil)", textAlign: "center" }}>
              <svg className="medal" style={{ width: 54, height: 54, margin: "0 auto" }} aria-hidden="true">
                <use href="#g-seal" />
              </svg>
              <div className="lbl" style={{ color: "var(--foil)", marginTop: 3 }}>
                {tier.name}
              </div>
            </div>
          </div>

          <h1 className="cert-title">&ldquo;{s.quote}&rdquo;</h1>
          {/* Citations are conferred only at Diamond and above. Scarcity is
              what makes the upper grades mean anything. */}
          {s.citation && (tier.key === "diamond" || tier.key === "kohinoor") && (
            <p className="citation">{s.citation}</p>
          )}
          <p className="cert-attrib">
            {neta ? <Link href={`/neta/${neta.slug}`}>{neta.name}</Link> : "Unknown"}
            {neta && ` · ${neta.office} · ${neta.state}`} · {s.venue}
          </p>

          <ClipFacade />

          <div className="verdict">
            <div>
              <span className="lbl">Rating</span>
              <b>{provisional ? "—" : s.gp.toLocaleString("en-IN")}</b>
            </div>
            <div>
              <span className="lbl">Global rank</span>
              <b>{rank ? `#${rank}` : "—"}</b>
            </div>
            <div>
              <span className="lbl">Duels</span>
              <b>{s.duels.toLocaleString("en-IN")}</b>
            </div>
            <div>
              <span className="lbl">Category</span>
              <b style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>{s.category}</b>
            </div>
            <div>
              <span className="lbl">Tier</span>
              <div className="tier-line" style={{ color: tier.colour }}>
                <Medal tier={tier.key} title={false} />
                <span>{tier.name}</span>
              </div>
            </div>
          </div>

          {s.note && (
            <div className="committee-note">
              <span className="lbl">The Committee&rsquo;s note</span>
              <p>{s.note}</p>
            </div>
          )}

          {s.reply && (
            <div className="erratum">
              <span className="lbl">Right of reply &middot; pinned</span>
              <p>{s.reply}</p>
            </div>
          )}

          <div className="scrubber">
            <div className="lbl">Context &middot; 60 seconds either side</div>
            <div className="scrub-track">
              <i className="pre" />
              <i className="mid" />
              <i className="post" />
            </div>
            <div className="scrub-legend lbl">
              <span>&minus;60s</span>
              <span style={{ color: "var(--seal)" }}>Indexed portion</span>
              <span>+60s</span>
            </div>
            <p style={{ fontSize: 14, color: "var(--ink-70)", margin: "9px 0 0" }}>
              <em>The context does not help.</em>
            </p>
          </div>

          <div className="parallel">
            <div className="col">
              <div className="lbl">Original &middot; {s.language}</div>
              <ol className={`transcript${s.script === "deva" ? " deva" : ""}`}>
                {s.originalLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </div>
            <div className="col">
              <div className="lbl">Translation &middot; English</div>
              <ol className="transcript">
                {s.englishLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
              <p style={{ fontSize: 12.5, color: "var(--ink-45)", marginTop: 12 }}>
                Translation contributed by a reader &middot;{" "}
                <Link href="/submit" style={{ color: "var(--seal)" }}>
                  suggest a correction
                </Link>
              </p>
            </div>
          </div>

          <div className="stamps">
            {s.sources.map((src) => (
              <span key={src.outlet} className={`stamp${src.tier === "A" ? " green" : ""}`}>
                Tier {src.tier} &middot; {src.outlet}
              </span>
            ))}
            <span className="stamp foil">Certified organic gyan &middot; no AI</span>
          </div>

          {!provisional && (
            <div className="axes">
              <div className="lbl" style={{ marginBottom: 8 }}>
                Judgment axes &middot; advisory ballot, {s.duels.toLocaleString("en-IN")} duels
              </div>
              {AXIS_LABELS.map(([key, label]) => (
                <div className="axis" key={key}>
                  <span>{label}</span>
                  <div className="bar">
                    <i style={{ width: `${s.axes[key]}%` }} />
                  </div>
                  <span className="val">{String(s.axes[key]).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!provisional && <StatementFooterNav slug={s.slug} />}
    </SiteFrame>
  );
}
