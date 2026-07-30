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
          The Board&rsquo;s five-part reading of the moment. These marks never
          alter public GP or rank.
        </p>
      </header>

      <div className={styles.profileGrid}>
        {SARCASM_LENSES.map((axis) => {
          const value = scoreSarcasmAxis(axes[axis.key]);
          return (
            <div className={styles.profileAxis} key={axis.key}>
              <div className={styles.profileAxisHead}>
                <span>{axis.label}</span>
                <strong>{value}</strong>
              </div>
              <div
                className={styles.profileTrack}
                role="meter"
                aria-label={`${axis.label}: ${value} out of 100`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
              >
                <i
                  className={styles.profileFill}
                  style={{ width: `${value}%` }}
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
