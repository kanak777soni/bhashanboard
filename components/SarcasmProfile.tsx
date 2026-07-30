import type { Axes } from "@/lib/types";
import {
  SARCASM_LENSES,
  scoreSarcasmAxis,
} from "@/lib/sarcasm";
import styles from "./AwardSystem.module.css";

export { sarcasmHighlights, sarcasmSignature } from "@/lib/sarcasm";

export default function SarcasmProfile({
  axes,
  compact = false,
  headingLevel = 2,
}: {
  axes: Axes;
  compact?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <section
      className={`${styles.profile} ${compact ? styles.profileCompact : ""}`}
      aria-labelledby="sarcasm-profile-title"
    >
      <header className={styles.profileHeader}>
        <div>
          <span className={styles.profileKicker}>The comic anatomy</span>
          <Heading id="sarcasm-profile-title">Sarcasm Profile</Heading>
        </div>
        <p className={styles.profileNote}>
          Four equal editorial marks describe the moment and set only its
          early provisional class. They never alter public GP or rank.
        </p>
      </header>

      <div className={styles.profileGrid}>
        {SARCASM_LENSES.map((axis) => {
          const value = scoreSarcasmAxis(axes[axis.key]);
          const rated = value !== null;
          return (
            <div
              className={`${styles.profileAxis} ${
                rated ? "" : styles.profileAxisUnrated
              }`}
              key={axis.key}
            >
              <div className={styles.profileAxisHead}>
                <span>{axis.label}</span>
                <strong>{rated ? value : "Unrated"}</strong>
              </div>
              <div
                className={styles.profileTrack}
                role={rated ? "meter" : undefined}
                aria-label={
                  rated
                    ? `${axis.label}: ${value} out of 100`
                    : `${axis.label}: not rated`
                }
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={rated ? value : undefined}
              >
                <i
                  className={styles.profileFill}
                  style={{ width: `${value ?? 0}%` }}
                />
              </div>
              <p className={styles.profileAxisPrompt}>
                {axis.prompt}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
