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
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const data = await getData();
  const party = data.partyByCode((await params).code);
  return party
    ? {
        title: party.name,
        description: `Every Bhashan Board entry involving representatives of the ${party.name}.`,
      }
    : { title: "Party not found" };
}

export default async function PartyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const data = await getData();
  const { code } = await params;
  const party = data.partyByCode(code);
  if (!party) notFound();

  const records = data.CORPUS.filter(
    (statement) => statement.partyAtTime === code
  ).sort(
    (a, b) =>
      a.daysAgo - b.daysAgo || a.corpusId.localeCompare(b.corpusId)
  );
  const liveVideos = data
    .liveVideoStatements()
    .filter((statement) => statement.partyAtTime === code);
  const rankedVideos = data
    .publicRankedStatements()
    .filter((statement) => statement.partyAtTime === code);
  const rankedRows = rankedVideos.map((statement) => ({
    statement,
    rank: data.publicRankOf(statement.slug),
    delta: 0,
  }));
  const share =
    data.CORPUS.length > 0
      ? Math.round((records.length / data.CORPUS.length) * 100)
      : 0;
  const people = [...new Set(records.map((statement) => statement.neta))];

  return (
    <SiteFrame>
      <h1 className="page-title">{party.name}</h1>
      <p className="lbl">
        <i className="swatch" style={{ background: party.ink }} />
        {party.code} &middot; {records.length} entries in the archive
      </p>

      <div className="statgrid" style={{ marginTop: 18 }}>
        <div>
          <span className="lbl">Archive entries</span>
          <b>{records.length}</b>
        </div>
        <div>
          <span className="lbl">Share of archive</span>
          <b>{share}%</b>
        </div>
        <div>
          <span className="lbl">Ready videos</span>
          <b>{liveVideos.length}</b>
        </div>
        <div>
          <span className="lbl">Publicly ranked</span>
          <b>{rankedVideos.length}</b>
        </div>
      </div>

      <div className="statblocks">
        <div>
          <span className="lbl">Representatives on record</span>
          <div style={{ fontSize: 14.5, lineHeight: 1.7, marginTop: 8 }}>
            {people.length > 0 ? (
              people.map((id, index) => {
                const neta = data.netaBySlug(id);
                return neta ? (
                  <span key={id}>
                    {index > 0 && " · "}
                    <Link
                      href={`/neta/${neta.slug}`}
                      style={{ textDecoration: "none" }}
                    >
                      {neta.name}
                    </Link>
                  </span>
                ) : null;
              })
            ) : (
              <span className="rail-note">No records indexed yet.</span>
            )}
          </div>
        </div>
        <div>
          <span className="lbl">Coverage, not a verdict</span>
          <p className="rail-note" style={{ marginTop: 8 }}>
            Party and entry counts describe what the archive contains.
            They do not measure the party or its representatives.
          </p>
        </div>
      </div>

      <p className="legend-foot" style={{ marginTop: 18 }}>
        Archive share changes when more clips and statements are added. It is
        never corrected through scores. The coverage note above explains the gap.
      </p>

      <div className="sec-head" style={{ marginTop: 32 }}>
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
            No live clip from this party has ten public votes yet. The archive
            remains browsable without rank, GP or medals.
          </p>
        </div>
      )}

      <div className="sec-head" style={{ marginTop: 32 }}>
        <h2>Complete archive</h2>
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
        {data.PARTIES.filter((item) => item.code !== code)
          .slice(0, 8)
          .map((item) => (
            <Link
              key={item.code}
              className="token"
              href={`/party/${item.code}`}
            >
              {item.code}
            </Link>
          ))}
      </p>
    </SiteFrame>
  );
}
