import Link from "next/link";
import EntryTitle from "@/components/EntryTitle";
import type { CorpusStatement } from "@/lib/corpus";
import type { Neta } from "@/lib/types";
import styles from "./PublicInventory.module.css";

export function researchState(statement: CorpusStatement): {
  label: string;
  note: string;
} {
  if (statement.video) {
    return {
      label: "Clip added",
      note: "This one is backstage for now. When it goes live, the video and voting will appear here.",
    };
  }
  return {
    label: "Clip wanted",
    note: "Know where the original video lives? Send the link and help put this one on the Board.",
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
