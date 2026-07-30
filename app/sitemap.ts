import type { MetadataRoute } from "next";
import { resolvedPublicSiteUrl } from "@/lib/auth-config";
import { getData } from "@/lib/data";
import { buildPublicInventory } from "@/lib/public-inventory";

const BASE = resolvedPublicSiteUrl();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getData();
  const inventory = buildPublicInventory(data.CORPUS);
  const statics = [
    "",
    "/watch",
    "/standings",
    "/record",
    "/netas",
    "/hall",
    "/rejected",
    "/rules",
    "/submit",
    "/privacy",
    "/terms",
    ...(inventory.liveVideos.length >= 2 ? ["/duel"] : []),
  ].map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.6,
  }));
  const entries = data.CORPUS.filter((s) => s.publicationEligible).map((s) => ({
    url: `${BASE}/statement/${s.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  const people = data.netasWithEntries().map((n) => ({
    url: `${BASE}/neta/${n.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  return [...statics, ...entries, ...people];
}
