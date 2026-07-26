import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import Medal from "@/components/Medal";
import EntryTitle from "@/components/EntryTitle";
import { netaBySlug, rankedStatements } from "@/lib/data";

export const metadata: Metadata = {
  title: "Hall of Fame",
  description: "Entries retired from active duelling into the permanent gallery.",
};

export default function HallPage() {
  // Until the first annual induction, the gallery previews the standing
  // candidates: everything currently at Kohinoor Class.
  const candidates = rankedStatements().filter((s) => s.gp >= 1875);

  return (
    <SiteFrame>
      <div className="sec-head" style={{ marginTop: 26 }}>
        <h1>Hall of Fame</h1>
        <span className="lbl">Retired hurt</span>
      </div>

      <p className="prose" style={{ marginTop: 16 }}>
        Once a year the Committee retires roughly five all-time entries from active duelling into a
        permanent gallery. This solves a genuine problem — the same legendary entries dominating the
        ladder forever — and creates an annual ceremony.
      </p>
      <p className="prose">
        The first induction has not yet taken place. Standing candidates are shown below.
      </p>

      <div style={{ marginTop: 24, borderTop: "2px solid var(--ink)" }}>
        {candidates.map((s, i) => {
          const neta = netaBySlug(s.neta);
          return (
            <article className="hall-entry" key={s.slug}>
              <div className="hall-rank">
                <Medal gp={s.gp} size={28} />
                <div className="num" style={{ fontSize: 11, color: "var(--ink-45)", marginTop: 2 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
              </div>
              <div>
                <Link href={`/statement/${s.slug}`} className="hall-quote">
                  <EntryTitle statement={s} />
                </Link>
                {s.citation && (
                  <div style={{ fontStyle: "italic", color: "var(--foil)", fontSize: 14, marginTop: 2 }}>
                    {s.citation}
                  </div>
                )}
                <div className="entry-sub" style={{ marginTop: 4 }}>
                  {neta?.name} &middot; {neta?.party} &middot; {neta?.state} &middot;{" "}
                  <span className="num">{s.duels.toLocaleString("en-IN")}</span> duels
                </div>
              </div>
              <div className="hall-gp">{s.gp.toLocaleString("en-IN")}</div>
            </article>
          );
        })}
      </div>
    </SiteFrame>
  );
}
