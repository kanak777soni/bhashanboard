import type { CSSProperties } from "react";
import Medal from "@/components/Medal";
import { tierOf } from "@/lib/tiers";
import styles from "./AwardSystem.module.css";

export type ClassAwardVariant = "compact" | "hero";

export default function ClassAward({
  gp,
  validVoteCount,
  performance,
  rank = 0,
  hallOfFame = false,
  variant = "compact",
  signature,
  className = "",
}: {
  gp: number;
  validVoteCount: number;
  performance?: number;
  rank?: number;
  hallOfFame?: boolean;
  variant?: ClassAwardVariant;
  signature?: { label: string; value: number };
  className?: string;
}) {
  const ranked = validVoteCount >= 10;
  const tier = ranked ? tierOf(gp) : null;
  const progress = Math.max(0, Math.min(10, validVoteCount));
  const awardColour = tier?.colour ?? "var(--ink-45)";
  const rootClassName = [
    styles.award,
    variant === "hero" ? styles.awardHero : styles.awardCompact,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClassName}
      style={{ "--award-colour": awardColour } as CSSProperties}
      aria-label={
        ranked
          ? `${tier?.name}, ${gp.toLocaleString("en-IN")} GP${
              rank > 0 ? `, public rank ${rank}` : ""
            }`
          : `Class pending, ${progress} of 10 votes`
      }
    >
      <div
        className={`${styles.medallion} ${
          ranked ? "" : styles.pendingMedallion
        }`}
        aria-hidden="true"
      >
        {tier ? (
          <Medal
            tier={tier.key}
            size={variant === "hero" ? 58 : 34}
            title={false}
          />
        ) : (
          <span>{progress}/10</span>
        )}
      </div>

      <div className={styles.copy}>
        {hallOfFame && ranked && (
          <div className={styles.hallRibbon}>Hall of Fame</div>
        )}
        <span className={styles.kicker}>
          {ranked ? "Class conferred" : "Public placement"}
        </span>
        <strong className={styles.className}>
          {tier?.name ?? "Class pending"}
        </strong>
        <div className={styles.meta}>
          {ranked ? (
            <>
              <span>
                <strong>{gp.toLocaleString("en-IN")}</strong> GP
              </span>
              {performance !== undefined && (
                <span>
                  Public score <strong>{Math.round(performance)}/100</strong>
                </span>
              )}
              {rank > 0 && (
                <span>
                  Public rank <strong>#{rank}</strong>
                </span>
              )}
              <span>
                <strong>{validVoteCount.toLocaleString("en-IN")}</strong>{" "}
                votes
              </span>
            </>
          ) : (
            <span>
              <strong>{progress}</strong> of 10 votes needed to receive a
              class
            </span>
          )}
        </div>
        {signature && (
          <div className={styles.signature}>
            {signature.label}
            <strong>{Math.round(signature.value)}/100</strong>
          </div>
        )}
      </div>
    </div>
  );
}
