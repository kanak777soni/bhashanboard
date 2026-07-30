import type { CSSProperties } from "react";
import Medal from "@/components/Medal";
import { resolveStatementClass } from "@/lib/classes";
import { PUBLIC_CLASS_MIN_VALID_VOTES } from "@/lib/rating";
import type { SarcasmHighlight } from "@/lib/sarcasm";
import type { Axes } from "@/lib/types";
import styles from "./AwardSystem.module.css";

export type ClassAwardVariant = "compact" | "hero";

export default function ClassAward({
  gp,
  validVoteCount,
  axes,
  performance,
  rank = 0,
  hallOfFame = false,
  variant = "compact",
  signatures,
  className = "",
}: {
  gp: number;
  validVoteCount: number;
  axes: Axes;
  performance?: number;
  rank?: number;
  hallOfFame?: boolean;
  variant?: ClassAwardVariant;
  signatures?: ReadonlyArray<SarcasmHighlight>;
  className?: string;
}) {
  const resolution = resolveStatementClass({ gp, validVoteCount, axes });
  const ranked = resolution.source === "public";
  const provisional = resolution.source === "provisional";
  const tier = resolution.tier;
  const progress = Math.max(
    0,
    Math.min(PUBLIC_CLASS_MIN_VALID_VOTES, validVoteCount),
  );
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
          : provisional
            ? `${tier?.name}, Board provisional class from the four-factor profile; ${progress} of ${PUBLIC_CLASS_MIN_VALID_VOTES} valid public votes`
            : `Provisional class unavailable until all four profile marks are set; ${progress} of ${PUBLIC_CLASS_MIN_VALID_VOTES} valid public votes`
      }
    >
      <div
        className={`${styles.medallion} ${
          resolution.source === "pending"
            ? styles.pendingMedallion
            : provisional
              ? styles.provisionalMedallion
              : ""
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
          <span>{progress}/{PUBLIC_CLASS_MIN_VALID_VOTES}</span>
        )}
      </div>

      <div className={styles.copy}>
        {hallOfFame && ranked && (
          <div className={styles.hallRibbon}>Hall of Fame</div>
        )}
        <span className={styles.kicker}>
          {ranked
            ? "Public class"
            : provisional
              ? "Board provisional"
              : "Profile awaiting review"}
        </span>
        <strong className={styles.className}>
          {tier?.name ?? "Provisional class pending"}
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
                valid votes
              </span>
            </>
          ) : provisional ? (
            <>
              <span>
                Four-factor profile{" "}
                <strong>
                  {resolution.profileTotal.toLocaleString("en-IN", {
                    maximumFractionDigits: 1,
                  })}
                  /20
                </strong>
              </span>
              <span>
                <strong>{progress}</strong>/
                {PUBLIC_CLASS_MIN_VALID_VOTES} valid public votes
              </span>
              <span>Public class replaces this preview at vote 10</span>
            </>
          ) : (
            <span>
              The four profile marks are not complete. Public class begins at{" "}
              {PUBLIC_CLASS_MIN_VALID_VOTES} valid votes.
            </span>
          )}
        </div>
        {signatures && signatures.length > 0 && (
          <div className={styles.signatures} aria-label="Strongest sarcasm traits">
            {signatures.slice(0, 2).map((signature) => (
              <span className={styles.signature} key={signature.label}>
                {signature.label}
                <strong>{Math.round(signature.value)}/100</strong>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
