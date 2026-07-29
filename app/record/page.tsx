import SiteFrame from "@/components/SiteFrame";
import QueryForm from "@/components/QueryForm";
import RecordList from "@/components/public/RecordList";
import styles from "@/components/public/PublicInventory.module.css";
import { CATEGORIES, getData } from "@/lib/data";
import { parseQuery, runQuery } from "@/lib/query";

export const metadata = {
  title: "The Record",
  description:
    "The complete Bhashan Board research archive, including files still awaiting verified footage.",
};

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getData();
  const inventory = data.publicInventory();
  const parsed = parseQuery(await searchParams);
  // A research record has no public tier. Keep ranking-only filters out of
  // this route and default to chronology instead of editorial seed GP.
  const query = {
    ...parsed,
    tier: "all",
    sort: parsed.sort === "rulings" ? "rulings" : "new",
  };
  const rows = runQuery(query, {
    statements: data.CORPUS,
    netas: data.NETAS,
  });

  return (
    <SiteFrame>
      <section className={styles.frontIntro}>
        <h1>The complete Record</h1>
        <p>
          Live screenings and unfinished research belong to the same archive,
          but not to the same standings. Unverified files remain searchable
          without receiving a rank, GP, or medal.
        </p>
      </section>

      <section className={styles.section} aria-label="State of the record">
        <div className="statgrid">
          <div>
            <span className="lbl">Ready to rule</span>
            <b>{inventory.liveVideos.length}</b>
          </div>
          <div>
            <span className="lbl">Evidence under review</span>
            <b>{inventory.videoUnderReview.length}</b>
          </div>
          <div>
            <span className="lbl">Awaiting footage</span>
            <b>{inventory.researchOnly.length}</b>
          </div>
          <div>
            <span className="lbl">Total searchable</span>
            <b>{data.CORPUS.length}</b>
          </div>
        </div>
      </section>

      <QueryForm
        query={query}
        resultCount={rows.length}
        total={data.CORPUS.length}
        parties={data.PARTIES.map((party) => ({
          code: party.code,
          name: party.name,
        }))}
        states={data.states()}
        categories={CATEGORIES}
        languages={[...new Set(data.CORPUS.map((statement) => statement.language))].sort()}
        basePath="/record"
        mode="record"
      />

      <RecordList
        statements={rows.map((row) => row.statement)}
        netas={data.NETAS}
      />
    </SiteFrame>
  );
}
