import Link from "next/link";
import EntryTitle from "@/components/EntryTitle";
import type { CorpusStatement } from "@/lib/corpus";
import type { Neta } from "@/lib/types";
import { researchState } from "./ResearchEntryCard";
import styles from "./PublicInventory.module.css";

function recordState(statement: CorpusStatement): {
  label: string;
  detail: string;
} {
  if (statement.publicationEligible && statement.video) {
    return {
      label: "Ready to rule",
      detail:
        statement.rating.validVoteCount >= 10
          ? "Ranked public video"
          : statement.rating.validVoteCount === 0
            ? "New video filing"
            : `${statement.rating.validVoteCount}/10 rulings`,
    };
  }
  const research = researchState(statement);
  return { label: research.label, detail: "Research file · unranked" };
}

export default function RecordList({
  statements,
  netas,
}: {
  statements: CorpusStatement[];
  netas: Neta[];
}) {
  const netaBySlug = new Map(netas.map((neta) => [neta.slug, neta]));

  if (statements.length === 0) {
    return <p className="empty">No records match this query.</p>;
  }

  return (
    <div className={styles.recordList}>
      {statements.map((statement) => {
        const neta = netaBySlug.get(statement.neta);
        const state = recordState(statement);
        return (
          <article className={styles.recordRow} key={statement.slug}>
            <div className={styles.recordState}>
              <strong>{state.label}</strong>
              <span className={styles.count}>{state.detail}</span>
              <span className={styles.count}>
                Entry {statement.corpusId} &middot; Tier {statement.bestSourceTier}
              </span>
            </div>
            <div>
              <Link className={styles.recordTitle} href={`/statement/${statement.slug}`}>
                <EntryTitle statement={statement} />
              </Link>
              <p className={styles.recordMeta}>
                {neta?.name ?? "Representative"} &middot; {statement.partyAtTime} &middot;{" "}
                {statement.category} &middot; {statement.language} &middot; {statement.venue}
              </p>
              {!statement.publicationEligible && statement.needs[0] && (
                <p className={styles.recordNeeds}>Next: {statement.needs[0]}</p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
