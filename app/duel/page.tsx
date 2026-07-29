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
          <span className="lbl">Waiting for a challenger</span>
        </div>
        <p className="prose" style={{ marginTop: 16 }}>
          One live clip is a monologue; two make a duel. Aamne-Saamne opens as
          soon as the Board has a pair.{" "}
          <Link href="/watch">See what is live</Link> or{" "}
          <Link href="/submit">send the next clip.</Link>
        </p>
      </SiteFrame>
    );
  }

  return <DuelStage entries={entries} />;
}
