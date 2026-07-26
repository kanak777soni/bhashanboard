import type { MetadataRoute } from "next";
import { CORPUS } from "@/lib/corpus";
import { netasWithEntries } from "@/lib/data";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bhashanboard.example";

export default function sitemap(): MetadataRoute.Sitemap {
  const statics = ["", "/duel", "/netas", "/hall", "/ledger", "/rejected", "/rules", "/submit"].map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.6,
  }));
  const entries = CORPUS.map((s) => ({
    url: `${BASE}/statement/${s.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  const people = netasWithEntries().map((n) => ({
    url: `${BASE}/neta/${n.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  return [...statics, ...entries, ...people];
}
