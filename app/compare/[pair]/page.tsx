import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EntryTitle from "@/components/EntryTitle";
import SiteFrame from "@/components/SiteFrame";
import { getData, type PublicData } from "@/lib/data";
import {
  ratingMaturityLabel,
  statementRatingMaturity,
} from "@/lib/public-inventory";
import type { CorpusStatement } from "@/lib/corpus";

function split(pair: string): [string, string] | null {
  const index = pair.indexOf("-vs-");
  if (index === -1) return null;
  return [pair.slice(0, index), pair.slice(index + 4)];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pair: string }>;
}): Promise<Metadata> {
  const data = await getData();
  const parts = split((await params).pair);
  const first = parts && data.netaBySlug(parts[0]);
  const second = parts && data.netaBySlug(parts[1]);
  if (!first || !second) return { title: "Comparison not found" };
  return {
    title: `${first.name} vs ${second.name}`,
    description: `Compare clips, archive entries and public standings for ${first.name} and ${second.name}.`,
  };
}

function profile(data: PublicData, slug: string) {
  const neta = data.netaBySlug(slug);
  if (!neta) return null;

  const entries = data.CORPUS.filter(
    (statement) => statement.neta === slug
  ).sort(
    (a, b) =>
      a.daysAgo - b.daysAgo || a.corpusId.localeCompare(b.corpusId)
  );
  const liveVideos = data
    .liveVideoStatements()
    .filter((statement) => statement.neta === slug);
  const rankedVideos = data
    .publicRankedStatements()
    .filter((statement) => statement.neta === slug);
  const bestPublicRank =
    rankedVideos.length > 0
      ? Math.min(
          ...rankedVideos.map((statement) =>
            data.publicRankOf(statement.slug)
          )
        )
      : null;
  const quoted = entries.filter((entry) => entry.hasVerbatimQuote).length;
  const categories = new Set(entries.map((entry) => entry.category)).size;

  return {
    neta,
    entries,
    liveVideos,
    rankedVideos,
    bestPublicRank,
    quoted,
    categories,
    party: data.partyByCode(neta.party),
  };
}

function entryState(data: PublicData, statement: CorpusStatement): string {
  if (statement.publicationEligible && statement.video) {
    const maturity = statementRatingMaturity(statement);
    if (maturity === "ranked") {
      return `Public rank #${data.publicRankOf(statement.slug)}`;
    }
    return ratingMaturityLabel(maturity);
  }
  if (statement.video) return "Clip on deck";
  return "Clip wanted";
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const data = await getData();
  const parts = split((await params).pair);
  if (!parts) notFound();
  const first = profile(data, parts[0]);
  const second = profile(data, parts[1]);
  if (!first || !second) notFound();

  const rows: [string, string, string][] = [
    [
      "Archive entries",
      String(first.entries.length),
      String(second.entries.length),
    ],
    [
      "Live clips",
      String(first.liveVideos.length),
      String(second.liveVideos.length),
    ],
    [
      "Publicly ranked",
      String(first.rankedVideos.length),
      String(second.rankedVideos.length),
    ],
    [
      "Best public rank",
      first.bestPublicRank ? `#${first.bestPublicRank}` : "Not yet ranked",
      second.bestPublicRank ? `#${second.bestPublicRank}` : "Not yet ranked",
    ],
    [
      "Verbatim wording established",
      `${first.quoted} of ${first.entries.length}`,
      `${second.quoted} of ${second.entries.length}`,
    ],
    [
      "Categories indexed",
      String(first.categories),
      String(second.categories),
    ],
  ];

  const side = (profileData: NonNullable<ReturnType<typeof profile>>) => (
    <div>
      <h2 className="compare-name">
        <Link
          href={`/neta/${profileData.neta.slug}`}
          style={{ textDecoration: "none" }}
        >
          {profileData.neta.name}
        </Link>
      </h2>
      <p className="lbl">
        <i
          className="swatch"
          style={{ background: profileData.party?.ink }}
        />
        <Link
          href={`/party/${profileData.neta.party}`}
          style={{ textDecoration: "none" }}
        >
          {profileData.neta.party}
        </Link>{" "}
        &middot; {profileData.neta.state}
      </p>
    </div>
  );

  return (
    <SiteFrame>
      <div className="sec-head" style={{ marginTop: 26 }}>
        <h1>Archive comparison</h1>
        <span className="lbl">Aamne-Saamne</span>
      </div>

      <div className="compare-heads">
        {side(first)}
        {side(second)}
      </div>

      <table className="compare-table">
        <tbody>
          {rows.map(([label, firstValue, secondValue]) => (
            <tr key={label}>
              <td className="compare-val">{firstValue}</td>
              <th className="compare-label">{label}</th>
              <td className="compare-val right">{secondValue}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="compare-heads" style={{ marginTop: 30 }}>
        {[first, second].map((profileData) => (
          <div key={profileData.neta.slug}>
            <span className="lbl">
              Archive &mdash; {profileData.neta.name}
            </span>
            {profileData.entries.length > 0 ? (
              <ul className="also-list" style={{ marginTop: 8 }}>
                {profileData.entries.map((entry) => (
                  <li key={entry.slug}>
                    <span className="mv flat" aria-hidden="true">
                      &middot;
                    </span>
                    <Link href={`/statement/${entry.slug}`}>
                      <EntryTitle statement={entry} />
                    </Link>
                    <span className="lbl">{entryState(data, entry)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No entries are in the archive yet.</p>
            )}
          </div>
        ))}
      </div>

      <p className="legend-foot" style={{ marginTop: 24 }}>
        This compares what is in the archive, not the people. Rank appears only
        after a live clip receives ten public votes; entries without a live clip
        receive no GP or medal. <Link href="/rules">See how scoring works.</Link>
      </p>
    </SiteFrame>
  );
}
