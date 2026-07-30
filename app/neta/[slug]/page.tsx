import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ClassAward from "@/components/ClassAward";
import EntryTitle from "@/components/EntryTitle";
import RecordList from "@/components/public/RecordList";
import SiteFrame from "@/components/SiteFrame";
import StandingsTable from "@/components/StandingsTable";
import { getData } from "@/lib/data";
import { sarcasmHighlights } from "@/lib/sarcasm";

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
    description: `${neta.office} · ${neta.party} · ${neta.state}. Clips and entries on The Bhashan Board.`,
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
  const bestClip = rankedVideos[0];
  const leadingPlacement = [...liveVideos]
    .filter((statement) => statement.rating.validVoteCount < 10)
    .sort(
      (a, b) =>
        b.rating.validVoteCount - a.rating.validVoteCount ||
        a.slug.localeCompare(b.slug),
    )[0];
  const cabinetClip = bestClip ?? leadingPlacement;
  const hallMoments = rankedVideos.filter(
    (statement) => statement.hallOfFame,
  ).length;
  const averageGp =
    rankedVideos.length > 0
      ? Math.round(
          rankedVideos.reduce((sum, statement) => sum + statement.gp, 0) /
            rankedVideos.length,
        )
      : null;
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
                An archive entry is not automatically a score. Rank, GP and
                medals appear after a live clip receives ten public votes.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="neta-award-cabinet" aria-labelledby="clip-cabinet">
        <div className="sec-head">
          <h2 id="clip-cabinet">Clip cabinet</h2>
          <span className="lbl">Honours belong to individual moments</span>
        </div>
        {cabinetClip ? (
          <div className="neta-cabinet-grid">
            <article className="neta-cabinet-feature">
              <span className="lbl">
                {bestClip ? "Best-performing public clip" : "Closest to a class"}
              </span>
              <Link
                className="neta-cabinet-title"
                href={`/statement/${cabinetClip.slug}`}
              >
                <EntryTitle statement={cabinetClip} />
              </Link>
              <ClassAward
                gp={cabinetClip.gp}
                validVoteCount={cabinetClip.rating.validVoteCount}
                performance={cabinetClip.rating.performance}
                rank={data.publicRankOf(cabinetClip.slug)}
                hallOfFame={cabinetClip.hallOfFame}
                signatures={sarcasmHighlights(cabinetClip.axes)}
              />
            </article>
            <dl className="neta-cabinet-stats">
              <div>
                <dt className="lbl">Classes conferred</dt>
                <dd className="num">{rankedVideos.length}</dd>
              </div>
              <div>
                <dt className="lbl">Hall moments</dt>
                <dd className="num">{hallMoments}</dd>
              </div>
              <div>
                <dt className="lbl">Average clip GP</dt>
                <dd className="num">
                  {averageGp?.toLocaleString("en-IN") ?? "—"}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="erratum">
            <span className="lbl">No live clip yet</span>
            <p>
              The archive below remains available, but no moment can receive a
              class until its video goes live and collects ten public votes.
            </p>
          </div>
        )}
      </section>

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
          Live clip &middot; ten votes to rank
        </span>
      </div>
      {rankedRows.length > 0 ? (
        <StandingsTable rows={rankedRows} hideNeta />
      ) : (
        <div className="erratum">
          <span className="lbl">No public rank yet</span>
          <p>
            None of this representative&rsquo;s clips has reached ten votes.
            The rest of the archive remains available below.
          </p>
        </div>
      )}

      <div className="sec-head" style={{ marginTop: 34 }}>
        <h2>Complete archive</h2>
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
