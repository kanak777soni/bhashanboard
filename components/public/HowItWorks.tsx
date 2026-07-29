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
        <span className="lbl">The Board&rsquo;s sitting</span>
        <h2 id={compact ? "watch-how-it-works" : "home-how-it-works"}>
          Watch. Rule. Confer the class.
        </h2>
        <p>See the whole moment before deciding how hard it lands.</p>
      </div>

      <ol className={styles.howSteps}>
        <li>
          <b className="num">01</b>
          <strong>Watch the moment</strong>
          <span>Stay for at least 90% of the clip and see it through.</span>
        </li>
        <li>
          <b className="num">02</b>
          <strong>Enter one ruling</strong>
          <span>Flat, Wry, Sharp, Savage or Historic. One vote per account.</span>
        </li>
        <li>
          <b className="num">03</b>
          <strong>Confer the class</strong>
          <span>Every vote weighs the same. Ten rulings place the clip on the Board.</span>
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
          <Link href="/watch">Take your seat</Link>
          <span aria-hidden="true">&middot;</span>
          <Link href="/rules">How GP and voting work</Link>
        </p>
      )}
    </section>
  );
}
