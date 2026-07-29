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
      label: "Live clip",
      detail:
        statement.rating.validVoteCount >= 10
          ? "On the standings"
          : statement.rating.validVoteCount === 0
            ? "Fresh on the Board"
            : `${statement.rating.validVoteCount}/10 votes`,
    };
  }
  const research = researchState(statement);
  return { label: research.label, detail: "In the archive · not on the standings" };
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
        const metadata = [
          neta?.name ?? "Representative",
          statement.partyAtTime,
          statement.category,
          statement.language,
          statement.venue,
        ].filter(Boolean);
        return (
          <article className={styles.recordRow} key={statement.slug}>
            <div className={styles.recordState}>
              <strong>{state.label}</strong>
              <span className={styles.count}>{state.detail}</span>
              <span className={styles.count}>
                Entry {statement.corpusId}
              </span>
            </div>
            <div>
              <Link className={styles.recordTitle} href={`/statement/${statement.slug}`}>
                <EntryTitle statement={statement} />
              </Link>
              <p className={styles.recordMeta}>
                {metadata.join(" · ")}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
