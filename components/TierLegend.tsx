import Link from "next/link";
import Medal from "./Medal";
import { TIERS } from "@/lib/tiers";
import { getData } from "@/lib/data";
import { tierOf } from "@/lib/tiers";

/**
 * The grading scale. The medals are the central device of the whole site
 * and until now there was no key anywhere — a reader could not learn what
 * the glyphs meant. Presented as an official scale, because that is the
 * joke: the apparatus is real, the subject is not.
 */
export default async function TierLegend({ compact = false }: { compact?: boolean }) {
  const data = await getData();
  const all = data.rankedStatements();
  const counts = new Map<string, number>();
  all.forEach((s) => {
    const k = tierOf(s.gp).key;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });

  return (
    <section className={`legend${compact ? " compact" : ""}`}>
      <h2 className="lbl legend-head">The scale of conferment</h2>
      <table className="legend-table">
        <tbody>
          {TIERS.map((t) => {
            const n = counts.get(t.key) ?? 0;
            const pct = all.length ? Math.round((n / all.length) * 100) : 0;
            return (
              <tr key={t.key}>
                <td className="legend-medal">
                  <Medal tier={t.key} size={19} title={false} />
                </td>
                <td className="legend-name">{t.name}</td>
                <td className="legend-band num">{t.min ? `${t.min.toLocaleString("en-IN")}+` : "under 1,300"}</td>
                <td className="legend-count num">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="legend-foot">
        Conferment is by rating alone. Bands are fixed, so the upper grades stay scarce.{" "}
        <Link href="/rules">The rubric is published.</Link>
      </p>
    </section>
  );
}
