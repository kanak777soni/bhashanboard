import type { Axes } from "@/lib/types";
import styles from "./AwardSystem.module.css";

const PROFILE_AXES: ReadonlyArray<{
  key: keyof Axes;
  label: string;
}> = [
  { key: "logic", label: "Logic Break" },
  { key: "straightFace", label: "Straight-Face Delivery" },
  { key: "rewatch", label: "Replay Value" },
  { key: "crowd", label: "Crowd Complicity" },
  { key: "consequence", label: "No Consequence" },
];

function score(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function sarcasmSignature(
  axes: Axes,
): { label: string; value: number } {
  return PROFILE_AXES.reduce(
    (best, axis) => {
      const value = score(axes[axis.key]);
      return value > best.value ? { label: axis.label, value } : best;
    },
    { label: PROFILE_AXES[0].label, value: score(axes.logic) },
  );
}

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
        {PROFILE_AXES.map((axis) => {
          const value = score(axes[axis.key]);
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
