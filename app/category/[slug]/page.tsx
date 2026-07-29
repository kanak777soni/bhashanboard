import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RecordList from "@/components/public/RecordList";
import SiteFrame from "@/components/SiteFrame";
import StandingsTable from "@/components/StandingsTable";
import { slugify } from "@/lib/corpus";
import { CATEGORIES, getData } from "@/lib/data";

const BLURB: Record<string, string> = {
  "Science & Reason":
    "Claims about how the physical world works, made by people who could have asked someone.",
  History: "Assertions about the past that the past does not support.",
  Economics: "Numbers, and what was done to them.",
  Whataboutery: "Answers to questions other than the one asked.",
  "Standing Ovation":
    "Entries where the room went along with it. The darkest category, and the point of the exercise.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = CATEGORIES.find((item) => slugify(item) === slug);
  return category
    ? { title: category, description: BLURB[category] }
    : { title: "Category not found" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const data = await getData();
  const { slug } = await params;
  const category = CATEGORIES.find((item) => slugify(item) === slug);
  if (!category) notFound();

  const records = data.CORPUS.filter(
    (statement) => statement.category === category
  ).sort(
    (a, b) =>
      a.daysAgo - b.daysAgo || a.corpusId.localeCompare(b.corpusId)
  );
  const liveVideos = data
    .liveVideoStatements()
    .filter((statement) => statement.category === category);
  const rankedVideos = data
    .publicRankedStatements()
    .filter((statement) => statement.category === category);
  const rankedRows = rankedVideos.map((statement) => ({
    statement,
    rank: data.publicRankOf(statement.slug),
    delta: 0,
  }));
  const representatives = new Set(records.map((statement) => statement.neta))
    .size;

  return (
    <SiteFrame>
      <h1 className="page-title">{category}</h1>
      <p
        className="prose"
        style={{ fontStyle: "italic", color: "var(--ink-70)" }}
      >
        {BLURB[category]}
      </p>

      <div className="statgrid" style={{ marginTop: 18 }}>
        <div>
          <span className="lbl">Archive entries</span>
          <b>{records.length}</b>
        </div>
        <div>
          <span className="lbl">Ready videos</span>
          <b>{liveVideos.length}</b>
        </div>
        <div>
          <span className="lbl">Publicly ranked</span>
          <b>{rankedVideos.length}</b>
        </div>
        <div>
          <span className="lbl">Representatives</span>
          <b>{representatives}</b>
        </div>
      </div>

      <div className="sec-head" style={{ marginTop: 28 }}>
        <h2>Public standings</h2>
        <span className="lbl">
          Live clip &middot; ten votes to rank
        </span>
      </div>
      {rankedRows.length > 0 ? (
        <StandingsTable rows={rankedRows} />
      ) : (
        <div className="erratum">
          <span className="lbl">No public rank yet</span>
          <p>
            This category has no live clip with ten public votes yet. Its
            archive entries remain visible below without rank, GP or medals.
          </p>
        </div>
      )}

      <div className="sec-head" style={{ marginTop: 30 }}>
        <h2>Complete category file</h2>
        <span className="lbl">{records.length} indexed chronologically</span>
      </div>
      <RecordList statements={records} netas={data.NETAS} />

      <p
        style={{
          marginTop: 20,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {CATEGORIES.filter((item) => item !== category).map((item) => (
          <Link
            key={item}
            className="token"
            href={`/category/${slugify(item)}`}
          >
            {item}
          </Link>
        ))}
      </p>
    </SiteFrame>
  );
}
