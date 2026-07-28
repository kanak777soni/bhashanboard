import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import QueryForm from "@/components/QueryForm";
import StandingsTable from "@/components/StandingsTable";
import TierLegend from "@/components/TierLegend";
import EntryTitle from "@/components/EntryTitle";
import CoverageNote from "@/components/CoverageNote";
import { CATEGORIES, getData } from "@/lib/data";
import { parseQuery, runQuery } from "@/lib/query";

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getData();
  const publicationReady = data.CORPUS.filter(
    (statement) => statement.publicationEligible
  ).length;
  const awaitingVerification = data.STATS.indexed - publicationReady;
  const query = parseQuery(await searchParams);
  const rows = runQuery(query, {
    statements: data.rankedStatements(),
    netas: data.NETAS,
  });

  return (
    <SiteFrame>
      <QueryForm
        query={query}
        resultCount={rows.length}
        total={data.STATEMENTS.length}
        parties={data.PARTIES.map((p) => ({ code: p.code, name: p.name }))}
        states={data.states()}
        categories={CATEGORIES}
        languages={data.languages()}
      />

      <div className="columns">
        <div>
          <div className="sec-head">
            <h1>The Standings</h1>
            <span className="lbl">Seed ladder · public rulings after verification</span>
          </div>
          <StandingsTable rows={rows} term={query.q} />
          <p style={{ marginTop: 18 }} className="lbl">
            GP uses verified public rulings where available; otherwise the published editorial seed rubric remains visible.
          </p>
        </div>

        <aside className="rail">
          {/* Aamne-Saamne stays as a playful discovery surface. Official
              ratings are entered on each statement after watching evidence. */}
          <section className="rail-block summons">
            <h2>The Committee is sitting</h2>
            <p className="rail-note">
              Two entries are placed before you. Pick the more magnificent one for sport; this exhibition
              does not alter either statement&rsquo;s rating.
            </p>
            <Link className="btn seal summons-btn" href="/duel">
              Enter the exhibition
            </Link>
            <p className="lbl summons-foot">
              Aamne-Saamne &middot; <span className="num">{data.STATEMENTS.length}</span> entries in the pool
            </p>
          </section>

          <CoverageNote />

          <TierLegend compact />

          <section className="rail-block">
            <h2>State of the record</h2>
            <dl className="record-state">
              <div>
                <dt className="lbl">Indexed</dt>
                <dd className="num">{data.STATS.indexed}</dd>
              </div>
              <div>
                <dt className="lbl">On the ladder</dt>
                <dd className="num">{data.STATS.onLadder}</dd>
              </div>
              <div>
                <dt className="lbl">Verbatim quote established</dt>
                <dd className="num">
                  {data.STATS.withVerbatimQuote} / {data.STATS.indexed}
                </dd>
              </div>
              <div>
                <dt className="lbl">Representatives</dt>
                <dd className="num">{data.STATS.representatives}</dd>
              </div>
            </dl>
            <p className="rail-note" style={{ marginTop: 10 }}>
              {publicationReady.toLocaleString("en-IN")} publication-ready;{" "}
              {awaitingVerification.toLocaleString("en-IN")} awaiting final verification.{" "}
              <Link href="/ledger">The ledger explains what is missing.</Link>
            </p>
          </section>
        </aside>
      </div>
    </SiteFrame>
  );
}
