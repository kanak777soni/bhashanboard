import type { Metadata } from "next";
import Link from "next/link";
import DuelStage, { type DuelEntry } from "@/components/DuelStage";
import SiteFrame from "@/components/SiteFrame";
import { getData } from "@/lib/data";
import { buildPublicInventory } from "@/lib/public-inventory";

export const metadata: Metadata = {
  title: "Aamne-Saamne",
  description: "Two statements. One magnificent question. A non-scoring exhibition.",
};

export default async function DuelPage() {
  const data = await getData();
  const inventory = buildPublicInventory(data.CORPUS);
  const entries: DuelEntry[] = inventory.liveVideos.map((s) => {
    const neta = data.netaBySlug(s.neta);
    return {
      slug: s.slug,
      quote: s.quote,
      neta: neta?.name ?? "Unknown",
      party: s.partyAtTime,
      state: neta?.state ?? "—",
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
          At least two publication-ready video entries are required before an
          exhibition can be convened. Editorial seed scores and text-only
          research files are never used here.{" "}
          <Link href="/watch">Return to the screening room.</Link>
        </p>
      </SiteFrame>
    );
  }

  return <DuelStage entries={entries} />;
}
