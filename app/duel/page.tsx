import type { Metadata } from "next";
import Link from "next/link";
import DuelStage, { type DuelEntry } from "@/components/DuelStage";
import SiteFrame from "@/components/SiteFrame";
import { getData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Aamne-Saamne",
  description: "Two statements. One question. The duel that produces the ranking.",
};

export default async function DuelPage() {
  const data = await getData();
  const entries: DuelEntry[] = data.rankedStatements().map((s) => {
    const neta = data.netaBySlug(s.neta);
    return {
      slug: s.slug,
      quote: s.quote,
      neta: neta?.name ?? "Unknown",
      party: s.partyAtTime,
      state: neta?.state ?? "—",
      gp: s.gp,
      duels: s.duels,
      hasQuote: s.hasVerbatimQuote,
      language: s.language,
    };
  });

  if (entries.length < 2) {
    return (
      <SiteFrame>
        <div className="sec-head" style={{ marginTop: 26 }}>
          <h1>Aamne-Saamne</h1>
          <span className="lbl">The Committee is waiting</span>
        </div>
        <p className="prose" style={{ marginTop: 16 }}>
          At least two published entries are required before a duel can be convened.{" "}
          <Link href="/">Return to the record.</Link>
        </p>
      </SiteFrame>
    );
  }

  return <DuelStage entries={entries} />;
}
