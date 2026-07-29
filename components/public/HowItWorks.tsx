import Link from "next/link";
import styles from "./PublicInventory.module.css";

const SCALE = [
  ["Flat", "0"],
  ["Wry", "25"],
  ["Sharp", "50"],
  ["Savage", "75"],
  ["Historic", "100"],
] as const;

export default function HowItWorks({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`${styles.howItWorks} ${compact ? styles.howItWorksCompact : ""}`}
      aria-labelledby={compact ? "watch-how-it-works" : "home-how-it-works"}
    >
      <div className={styles.howIntro}>
        <span className="lbl">Three steps, no homework</span>
        <h2 id={compact ? "watch-how-it-works" : "home-how-it-works"}>
          Watch. Vote. See where it lands.
        </h2>
        <p>The clip plays first. Your score comes after.</p>
      </div>

      <ol className={styles.howSteps}>
        <li>
          <b className="num">01</b>
          <strong>Play the clip</strong>
          <span>Watch at least 90% and stay through the end.</span>
        </li>
        <li>
          <b className="num">02</b>
          <strong>Pick how it lands</strong>
          <span>Flat, Wry, Sharp, Savage or Historic. One vote per account.</span>
        </li>
        <li>
          <b className="num">03</b>
          <strong>Watch the Board move</strong>
          <span>Every vote weighs the same. Ten votes open a place in the standings.</span>
        </li>
      </ol>

      <div className={styles.howScale} aria-label="The five public vote choices">
        {SCALE.map(([label, value]) => (
          <span key={value}>
            <b>{label}</b>
            <small className="num">{value}</small>
          </span>
        ))}
      </div>

      {!compact && (
        <p className={styles.howFoot}>
          <Link href="/watch">Open the clips</Link>
          <span aria-hidden="true">&middot;</span>
          <Link href="/rules">How GP and voting work</Link>
        </p>
      )}
    </section>
  );
}
