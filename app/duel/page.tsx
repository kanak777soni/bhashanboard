import type { Metadata } from "next";
import DuelStage, { type DuelEntry } from "@/components/DuelStage";
import { netaBySlug, rankedStatements } from "@/lib/data";

export const metadata: Metadata = {
  title: "Aamne-Saamne",
  description: "Two statements. One question. The duel that produces the ranking.",
};

export default function DuelPage() {
  const entries: DuelEntry[] = rankedStatements().map((s) => {
    const neta = netaBySlug(s.neta);
    return {
      slug: s.slug,
      quote: s.quote,
      neta: neta?.name ?? "Unknown",
      party: neta?.party ?? "—",
      state: neta?.state ?? "—",
      gp: s.gp,
      duels: s.duels,
    };
  });

  return <DuelStage entries={entries} />;
}
