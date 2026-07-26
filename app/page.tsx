import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import QueryForm from "@/components/QueryForm";
import StandingsTable from "@/components/StandingsTable";
import TierLegend from "@/components/TierLegend";
import { CATEGORIES, IN_PLACEMENT, PARTIES, STATEMENTS, languages, states } from "@/lib/data";
import { parseQuery, runQuery } from "@/lib/query";
import { PLACEMENT_DUELS } from "@/lib/elo";
import { tierByKey } from "@/lib/tiers";

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

          <TierLegend compact />

          <section className="rail-block">
            <h2>Now in placement</h2>
            {IN_PLACEMENT.map((s) => (
              <div className="placement" key={s.slug}>
                <p>
                  <Link href={`/statement/${s.slug}`}>&ldquo;{s.quote}&rdquo;</Link>
                </p>
                <div className="meter">
                  <i style={{ width: `${((s.placement ?? 0) / PLACEMENT_DUELS) * 100}%` }} />
                </div>
                <span className="lbl">
                  Placement <span className="num">{s.placement}</span>/{PLACEMENT_DUELS} &middot; projected{" "}
                  {tierByKey(s.projected ?? "gold").name}
                </span>
              </div>
            ))}
          </section>

          <section className="rail-block">
            <h2>The public disagrees</h2>
            <p className="rail-note" style={{ marginBottom: 10 }}>
              Entries where the advisory ballot departs from the Committee&rsquo;s ruling. The ballot does
              not yet carry weight.
            </p>
            <div className="divergence">
              <span>Potato factory</span>
              <span className="lbl">Committee Diamond &middot; Public Kohinoor</span>
            </div>
            <div className="divergence">
              <span>Gravity in winter</span>
              <span className="lbl">Committee Gold &middot; Public Diamond</span>
            </div>
            <div className="divergence">
              <span>History began 1976</span>
              <span className="lbl">Committee Gold &middot; Public Silver</span>
            </div>
          </section>

          <section className="rail-block">
            <h2>From the ledger</h2>
            <p className="rail-note">
              Three entries withdrawn this month following review. Two translations corrected. One right of
              reply received and pinned. <Link href="/ledger">We keep score of ourselves.</Link>
            </p>
          </section>
        </aside>
      </div>
    </SiteFrame>
  );
}
