import Link from "next/link";
import Medal from "@/components/Medal";
import type { CorpusStatement } from "@/lib/corpus";
import { TIERS, tierOf } from "@/lib/tiers";
import type { TierKey } from "@/lib/types";
import styles from "./AwardSystem.module.css";

export default function ClassLadder({
  statements,
  selectedTier,
  headingLevel = 2,
}: {
  statements: ReadonlyArray<
    Pick<CorpusStatement, "gp" | "rating">
  >;
  selectedTier?: string;
  headingLevel?: 2 | 3;
}) {
  const counts = new Map<TierKey, number>();
  statements
    .filter((statement) => statement.rating.validVoteCount >= 10)
    .forEach((statement) => {
      const key = tierOf(statement.gp).key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const ladder = [...TIERS].reverse();

  return (
    <section className={styles.ladder} aria-labelledby="class-ladder-title">
      <header className={styles.ladderHead}>
        <div>
          <span className={styles.ladderKicker}>The scale of conferment</span>
          <Heading id="class-ladder-title">Road to Kohinoor</Heading>
        </div>
        <p className={styles.ladderNote}>
          Classes belong to clips, not people. Ten public votes are required
          before any class is conferred.
        </p>
      </header>

      <div className={styles.ladderRail}>
        {ladder.map((tier) => {
          const active = selectedTier === tier.key;
          const range =
            tier.key === "participation"
              ? "Below 1,300 GP"
              : `${tier.min.toLocaleString("en-IN")}+ GP`;
          return (
            <Link
              className={`${styles.classCard} ${
                active ? styles.classCardActive : ""
              }`}
              href={`/standings?tier=${tier.key}`}
              key={tier.key}
              aria-current={active ? "page" : undefined}
            >
              <div className={styles.classMedal}>
                <Medal tier={tier.key} size={24} title={false} />
                <strong>{tier.name}</strong>
              </div>
              <span />
              <div className={styles.classFoot}>
                <span className={styles.classRange}>{range}</span>
                <span className={styles.classCount}>
                  {counts.get(tier.key) ?? 0}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
