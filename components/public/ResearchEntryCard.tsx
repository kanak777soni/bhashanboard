import Link from "next/link";
import EntryTitle from "@/components/EntryTitle";
import type { CorpusStatement } from "@/lib/corpus";
import type { Neta } from "@/lib/types";
import styles from "./PublicInventory.module.css";

export function researchState(statement: CorpusStatement): {
  label: string;
  note: string;
} {
  const holdNote = statement.held
    ? " An editorial hold is also active while the Committee reviews attribution, context, or source quality."
    : "";
  if (statement.video) {
    return {
      label: "Evidence under review",
      note: `Footage is attached, but wording, context, source checks, or sign-off remain.${holdNote}`,
    };
  }
  return {
    label: "Awaiting verified footage",
    note: `This research file stays unranked until a bounded source clip is established.${holdNote}`,
  };
}

export default function ResearchEntryCard({
  statement,
  neta,
}: {
  statement: CorpusStatement;
  neta?: Neta;
}) {
  const state = researchState(statement);

  return (
    <article className={styles.researchCard}>
      <div className={styles.eyebrow}>
        <span>{state.label}</span>
      </div>
      <Link className={styles.researchTitle} href={`/statement/${statement.slug}`}>
        <EntryTitle statement={statement} />
      </Link>
      <div className={styles.meta}>
        {neta?.name ?? "Representative"} &middot; {statement.partyAtTime} &middot;{" "}
        {statement.category}
      </div>
      <p className={styles.researchNote}>{state.note}</p>
    </article>
  );
}
