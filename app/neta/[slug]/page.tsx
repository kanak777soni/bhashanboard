import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/SiteFrame";
import Medal from "@/components/Medal";
import StandingsTable from "@/components/StandingsTable";
import { NETAS, netaBySlug, partyByCode, rankOf, statementsByNeta } from "@/lib/data";
import { TIERS, tierOf } from "@/lib/tiers";

export function generateStaticParams() {
  return NETAS.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const n = netaBySlug((await params).slug);
  if (!n) return { title: "Representative not found" };
  return { title: n.name, description: `${n.office} · ${n.party} · ${n.state}. Career record on the Bhashan Board.` };
}

/** Honorifics are conferred by the algorithm from axis dominance, never
 *  hand-written — funnier, and considerably safer (docs/02 §2.7). */
function honorifics(slugs: { category: string }[]): string[] {
  const counts = new Map<string, number>();
  slugs.forEach((s) => counts.set(s.category, (counts.get(s.category) ?? 0) + 1));
  const titles: Record<string, string> = {
    "Science & Reason": "Professor of Applied Physics",
    History: "The Time Traveller",
    Economics: "Chief Economist",
    Whataboutery: "Whataboutery — Regional Champion",
    "Standing Ovation": "Fellow of the Standing Ovation",
  };
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([cat]) => titles[cat] ?? cat);
}

function Arc({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 100;
  const h = 30;
  const min = Math.min(...points) - 40;
  const max = Math.max(...points) + 40;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / (max - min)) * h;
      return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const lastX = w;
  const lastY = h - ((points[points.length - 1] - min) / (max - min)) * h;
  return (
    <svg className="arc" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Career rating arc">
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="1.4" fill="var(--seal)" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default async function NetaPage({ params }: { params: Promise<{ slug: string }> }) {
  const neta = netaBySlug((await params).slug);
  if (!neta) notFound();

  const party = partyByCode(neta.party);
  const entries = statementsByNeta(neta.slug);
  const rows = entries.map((s) => ({ statement: s, rank: rankOf(s.slug), delta: s.previousRank - rankOf(s.slug) }));

  const careerGp = entries.reduce((sum, s) => sum + s.gp, 0);
  const peak = entries.length ? Math.max(...entries.map((s) => s.gp)) : 0;
  const mean = entries.length ? careerGp / entries.length : 0;
  const sd = entries.length
    ? Math.sqrt(entries.reduce((a, s) => a + (s.gp - mean) ** 2, 0) / entries.length)
    : 0;
  const consistency = sd < 120 ? "Remarkably reliable" : sd < 220 ? "Broadly dependable" : "Streaky";

  const cabinet = TIERS.map((t) => ({
    tier: t,
    count: entries.filter((s) => tierOf(s.gp).key === t.key).length,
  })).filter((c) => c.count > 0);

  return (
    <SiteFrame>
      <h1 className="page-title">{neta.name}</h1>
      <p className="lbl">
        {neta.office} &middot; <i className="swatch" style={{ background: party?.ink }} />
        {party?.name} &middot; {neta.state}
      </p>

      <div className="statsheet">
        <div className="portrait" aria-hidden="true">
          {neta.name.charAt(0)}
        </div>

        <div>
          <div className="statgrid">
            <div>
              <span className="lbl">Career GP</span>
              <b>{careerGp.toLocaleString("en-IN")}</b>
            </div>
            <div>
              <span className="lbl">Peak rating</span>
              <b>{peak.toLocaleString("en-IN")}</b>
            </div>
            <div>
              <span className="lbl">Entries</span>
              <b>{entries.length}</b>
            </div>
            <div>
              <span className="lbl">Best rank</span>
              <b>{entries.length ? `#${Math.min(...entries.map((s) => rankOf(s.slug)))}` : "—"}</b>
            </div>
          </div>

          <div className="statblocks">
            <div>
              <span className="lbl">Form &middot; last five</span>
              <div className="formguide">
                {entries.slice(0, 5).map((s) => (
                  <Medal key={s.slug} gp={s.gp} size={18} />
                ))}
              </div>
            </div>
            <div>
              <span className="lbl">Trophy cabinet</span>
              <div className="cabinet">
                {cabinet.map((c) => (
                  <div key={c.tier.key}>
                    <Medal tier={c.tier.key} size={18} />
                    &times;{c.count}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="lbl">Consistency</span>
              <div style={{ fontSize: 15 }}>{consistency}</div>
            </div>
          </div>

          <div className="statblocks">
            <div>
              <span className="lbl">Honorifics conferred</span>
              {honorifics(entries).map((h) => (
                <div key={h} className="honorific">
                  {h}
                </div>
              ))}
            </div>
            <div>
              <span className="lbl">Career arc &middot; {neta.arc.length} rulings</span>
              <Arc points={neta.arc} />
            </div>
          </div>
        </div>
      </div>

      <div className="erratum" style={{ marginTop: 30 }}>
        <span className="lbl">Right of reply</span>
        <p>
          {neta.replied
            ? "This office has responded to at least one entry. Responses are pinned above the relevant ruling, unedited."
            : "This office has not responded. The invitation stands, permanently."}
        </p>
      </div>

      <div className="sec-head" style={{ marginTop: 34 }}>
        <h2>Entries on record</h2>
        <span className="lbl">{entries.length} indexed</span>
      </div>
      <StandingsTable rows={rows} hideNeta />

      <p style={{ marginTop: 18 }}>
        <Link className="btn ghost" href="/netas">
          All representatives
        </Link>
      </p>
    </SiteFrame>
  );
}
