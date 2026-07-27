import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/SiteFrame";
import StandingsTable from "@/components/StandingsTable";
import Medal from "@/components/Medal";
import { getData } from "@/lib/data";
import { TIERS, tierOf } from "@/lib/tiers";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const data = await getData();
  const p = data.partyByCode((await params).code);
  return p
    ? { title: p.name, description: `Every indexed statement by representatives of the ${p.name}, ranked.` }
    : { title: "Party not found" };
}

export default async function PartyPage({ params }: { params: Promise<{ code: string }> }) {
  const data = await getData();
  const { code } = await params;
  const party = data.partyByCode(code);
  if (!party) notFound();

  const all = data.rankedStatements();
  const mine = all.filter((s) => s.partyAtTime === code);
  if (mine.length === 0) notFound();

  const rows = mine.map((s) => ({ statement: s, rank: data.rankOf(s.slug), delta: 0 }));
  const share = Math.round((mine.length / all.length) * 100);
  const best = data.rankOf(mine[0].slug);
  const people = [...new Set(mine.map((s) => s.neta))];
  const cabinet = TIERS.map((t) => ({ tier: t, n: mine.filter((s) => tierOf(s.gp).key === t.key).length })).filter((c) => c.n > 0);

  return (
    <SiteFrame>
      <h1 className="page-title">{party.name}</h1>
      <p className="lbl">
        <i className="swatch" style={{ background: party.ink }} />
        {party.code} &middot; {mine.length} entries on the ladder
      </p>

      <div className="statgrid" style={{ marginTop: 18 }}>
        <div><span className="lbl">Entries</span><b>{mine.length}</b></div>
        <div><span className="lbl">Share of ladder</span><b>{share}%</b></div>
        <div><span className="lbl">Best rank</span><b>#{best}</b></div>
        <div><span className="lbl">Representatives</span><b>{people.length}</b></div>
      </div>

      <div className="statblocks">
        <div>
          <span className="lbl">Grades held</span>
          <div className="cabinet">
            {cabinet.map((c) => (
              <div key={c.tier.key}><Medal tier={c.tier.key} size={18} />&times;{c.n}</div>
            ))}
          </div>
        </div>
        <div>
          <span className="lbl">On the record</span>
          <div style={{ fontSize: 14.5, lineHeight: 1.7 }}>
            {people.map((id, i) => {
              const n = data.netaBySlug(id);
              return n ? (
                <span key={id}>
                  {i > 0 && " · "}
                  <Link href={`/neta/${n.slug}`} style={{ textDecoration: "none" }}>{n.name}</Link>
                </span>
              ) : null;
            })}
          </div>
        </div>
      </div>

      <p className="legend-foot" style={{ marginTop: 18 }}>
        A party&rsquo;s share of the ladder reflects where the research has looked as much as what was
        said. <Link href="/ledger">The coverage note explains the gap.</Link>
      </p>

      <div className="sec-head" style={{ marginTop: 32 }}>
        <h2>Entries</h2>
        <span className="lbl">Ranked within the whole board</span>
      </div>
      <StandingsTable rows={rows} />

      <p style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {data.PARTIES.filter((p) => p.code !== code).slice(0, 8).map((p) => (
          <Link key={p.code} className="token" href={`/party/${p.code}`}>{p.code}</Link>
        ))}
      </p>
    </SiteFrame>
  );
}
