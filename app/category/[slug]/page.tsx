import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/SiteFrame";
import StandingsTable from "@/components/StandingsTable";
import { CATEGORIES, rankOf, rankedStatements } from "@/lib/data";
import { slugify } from "@/lib/corpus";

const BLURB: Record<string, string> = {
  "Science & Reason": "Claims about how the physical world works, made by people who could have asked someone.",
  History: "Assertions about the past that the past does not support.",
  Economics: "Numbers, and what was done to them.",
  Whataboutery: "Answers to questions other than the one asked.",
  "Standing Ovation": "Entries where the room went along with it. The darkest category, and the point of the exercise.",
};

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: slugify(c) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = CATEGORIES.find((x) => slugify(x) === slug);
  return c ? { title: c, description: BLURB[c] } : { title: "Category not found" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = CATEGORIES.find((c) => slugify(c) === slug);
  if (!category) notFound();

  const mine = rankedStatements().filter((s) => s.category === category);
  const rows = mine.map((s) => ({ statement: s, rank: rankOf(s.slug), delta: 0 }));

  return (
    <SiteFrame>
      <h1 className="page-title">{category}</h1>
      <p className="prose" style={{ fontStyle: "italic", color: "var(--ink-70)" }}>{BLURB[category]}</p>

      <div className="sec-head" style={{ marginTop: 24 }}>
        <h2>{mine.length} entries</h2>
        <span className="lbl">Ranked within the whole board</span>
      </div>
      <StandingsTable rows={rows} />

      <p style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {CATEGORIES.filter((c) => c !== category).map((c) => (
          <Link key={c} className="token" href={`/category/${slugify(c)}`}>{c}</Link>
        ))}
      </p>
    </SiteFrame>
  );
}
