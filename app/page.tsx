import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import QueryForm from "@/components/QueryForm";
import StandingsTable from "@/components/StandingsTable";
import TierLegend from "@/components/TierLegend";
import EntryTitle from "@/components/EntryTitle";
import CoverageNote from "@/components/CoverageNote";
import { CATEGORIES, PARTIES, STATEMENTS, STATS, languages, states } from "@/lib/data";
import { parseQuery, runQuery } from "@/lib/query";

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseQuery(await searchParams);
  const rows = runQuery(query);

  return (
    <SiteFrame>
      <QueryForm
        query={query}
        resultCount={rows.length}
        total={STATEMENTS.length}
        parties={PARTIES.map((p) => ({ code: p.code, name: p.name }))}
        states={states()}
        categories={CATEGORIES}
        languages={languages()}
      />

      <div className="columns">
        <div>
          <div className="sec-head">
            <h1>The Standings</h1>
            <span className="lbl">Ratified by the Committee</span>
          </div>
          <StandingsTable rows={rows} term={query.q} />
          <p style={{ marginTop: 18 }} className="lbl">
            Ratings are recomputed nightly from the duel record.
          </p>
        </div>

        <aside className="rail">
          {/* The duel is the retention engine. It was a small button below
              a sixteen-row table; it belongs at the top of the rail. */}
          <section className="rail-block summons">
            <h2>The Committee is sitting</h2>
            <p className="rail-note">
              Two entries are placed before you. You decide which is more magnificent. Ratings move
              accordingly.
            </p>
            <Link className="btn seal summons-btn" href="/duel">
              Take your seat
            </Link>
            <p className="lbl summons-foot">
              Aamne-Saamne &middot; <span className="num">{STATEMENTS.length}</span> entries in the pool
            </p>
          </section>

          <CoverageNote />

          <TierLegend compact />

          <section className="rail-block">
            <h2>State of the record</h2>
            <dl className="record-state">
              <div>
                <dt className="lbl">Indexed</dt>
                <dd className="num">{STATS.indexed}</dd>
              </div>
              <div>
                <dt className="lbl">On the ladder</dt>
                <dd className="num">{STATS.onLadder}</dd>
              </div>
              <div>
                <dt className="lbl">Verbatim quote established</dt>
                <dd className="num">
                  {STATS.withVerbatimQuote} / {STATS.indexed}
                </dd>
              </div>
              <div>
                <dt className="lbl">Representatives</dt>
                <dd className="num">{STATS.representatives}</dd>
              </div>
            </dl>
            <p className="rail-note" style={{ marginTop: 10 }}>
              Every entry is text-sourced and none is verified for publication.{" "}
              <Link href="/ledger">The ledger explains what is missing.</Link>
            </p>
          </section>
        </aside>
      </div>
    </SiteFrame>
  );
}
