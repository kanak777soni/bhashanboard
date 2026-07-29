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
        <span className="lbl">How the Board works</span>
        <h2 id={compact ? "watch-how-it-works" : "home-how-it-works"}>
          Watch. Rule once. Rank together.
        </h2>
        <p>
          The verification desk checks the clip and context. Verified members
          decide how the statement lands.
        </p>
      </div>

      <ol className={styles.howSteps}>
        <li>
          <b className="num">01</b>
          <strong>Watch the exact clip</strong>
          <span>Original footage, exact bounds, source and context attached.</span>
        </li>
        <li>
          <b className="num">02</b>
          <strong>Enter one ruling</strong>
          <span>Watch 90% and reach the end. One verified account, one final vote.</span>
        </li>
        <li>
          <b className="num">03</b>
          <strong>Reach the Standings</strong>
          <span>Every vote has equal weight. Public rank begins after ten rulings.</span>
        </li>
      </ol>

      <div className={styles.howScale} aria-label="The five public ruling choices">
        {SCALE.map(([label, value]) => (
          <span key={value}>
            <b>{label}</b>
            <small className="num">{value}</small>
          </span>
        ))}
      </div>

      {!compact && (
        <p className={styles.howFoot}>
          <Link href="/watch">Start watching</Link>
          <span aria-hidden="true">·</span>
          <Link href="/rules">Read the evidence and voting rules</Link>
        </p>
      )}
    </section>
  );
}
