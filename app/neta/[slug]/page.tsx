import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RecordList from "@/components/public/RecordList";
import SiteFrame from "@/components/SiteFrame";
import StandingsTable from "@/components/StandingsTable";
import { getData } from "@/lib/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const data = await getData();
  const neta = data.netaBySlug((await params).slug);
  if (!neta) return { title: "Representative not found" };
  return {
    title: neta.name,
    description: `${neta.office} · ${neta.party} · ${neta.state}. Research record on the Bhashan Board.`,
  };
}

export default async function NetaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const data = await getData();
  const neta = data.netaBySlug((await params).slug);
  if (!neta) notFound();

  const party = data.partyByCode(neta.party);
  const records = data.CORPUS.filter(
    (statement) => statement.neta === neta.slug
  ).sort(
    (a, b) =>
      a.daysAgo - b.daysAgo || a.corpusId.localeCompare(b.corpusId)
  );
  const liveVideos = data
    .liveVideoStatements()
    .filter((statement) => statement.neta === neta.slug);
  const rankedVideos = data
    .publicRankedStatements()
    .filter((statement) => statement.neta === neta.slug);
  const rankedRows = rankedVideos.map((statement) => ({
    statement,
    rank: data.publicRankOf(statement.slug),
    delta: 0,
  }));
  const categories = [...new Set(records.map((entry) => entry.category))].sort();

  const rivals = data.NETAS.filter(
    (candidate) =>
      candidate.slug !== neta.slug &&
      data.CORPUS.some((statement) => statement.neta === candidate.slug)
  )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 5);

  return (
    <SiteFrame>
      <h1 className="page-title">{neta.name}</h1>
      <p className="lbl">
        {neta.office} &middot;{" "}
        <i className="swatch" style={{ background: party?.ink }} />
        {party?.name} &middot; {neta.state}
      </p>

      <div className="statsheet">
        <div className="portrait" aria-hidden="true">
          {neta.name.charAt(0)}
        </div>

        <div>
          <div className="statgrid">
            <div>
              <span className="lbl">Research records</span>
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
              <span className="lbl">Categories indexed</span>
              <b>{categories.length}</b>
            </div>
          </div>

          <div className="statblocks">
            <div>
              <span className="lbl">Subjects in the file</span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {categories.length > 0 ? (
                  categories.map((category) => (
                    <span className="token" key={category}>
                      {category}
                    </span>
                  ))
                ) : (
                  <span className="rail-note">No records indexed yet.</span>
                )}
              </div>
            </div>
            <div>
              <span className="lbl">How to read this page</span>
              <p className="rail-note" style={{ marginTop: 8 }}>
                A research record is not a score. Rank, GP, and medals appear
                only for a publication-ready video after ten valid public
                rulings.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="erratum" style={{ marginTop: 30 }}>
        <span className="lbl">Right of reply</span>
        <p>
          {neta.replied
            ? "This office has responded to at least one entry. Responses are pinned above the relevant ruling, unedited."
            : "This office has not responded. The invitation stands, permanently."}
        </p>
      </div>

      <div className="sec-head" style={{ marginTop: 34 }}>
        <h2>Public standings</h2>
        <span className="lbl">
          Verified video &middot; ten public rulings required
        </span>
      </div>
      {rankedRows.length > 0 ? (
        <StandingsTable rows={rankedRows} hideNeta />
      ) : (
        <div className="erratum">
          <span className="lbl">No public rank yet</span>
          <p>
            None of this representative&rsquo;s video filings has reached the
            ten-ruling threshold. Research records remain available below
            without borrowing the editorial seed score.
          </p>
        </div>
      )}

      <div className="sec-head" style={{ marginTop: 34 }}>
        <h2>Complete research file</h2>
        <span className="lbl">{records.length} indexed chronologically</span>
      </div>
      <RecordList statements={records} netas={data.NETAS} />

      <div className="compare-invite">
        <span className="lbl">Compare archive coverage</span>
        <div className="compare-links">
          {rivals.map((rival) => (
            <Link
              key={rival.slug}
              className="token"
              href={`/compare/${neta.slug}-vs-${rival.slug}`}
            >
              with {rival.name}
            </Link>
          ))}
        </div>
      </div>

      <p style={{ marginTop: 18 }}>
        <Link className="btn ghost" href="/netas">
          All representatives
        </Link>{" "}
        <Link className="btn ghost" href={`/party/${neta.party}`}>
          {party?.name}
        </Link>
      </p>
    </SiteFrame>
  );
}
