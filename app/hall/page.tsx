import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import Medal from "@/components/Medal";
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

      <div style={{ display: "grid", gap: 0, marginTop: 26, borderTop: "2px solid var(--ink)" }}>
        {candidates.map((s, i) => {
          const neta = netaBySlug(s.neta);
          return (
            <article
              key={s.slug}
              style={{
                display: "flex",
                gap: 20,
                alignItems: "flex-start",
                padding: "20px 0",
                borderBottom: "1px solid var(--rule)",
              }}
            >
              <div style={{ textAlign: "center", flex: "none", width: 60 }}>
                <Medal gp={s.gp} size={34} />
                <div className="num" style={{ fontSize: 12, color: "var(--ink-45)", marginTop: 4 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
              </div>
              <div>
                <Link
                  href={`/statement/${s.slug}`}
                  style={{ fontFamily: "var(--font-display)", fontSize: 22, textDecoration: "none" }}
                >
                  &ldquo;{s.quote}&rdquo;
                </Link>
                <div className="entry-sub" style={{ marginTop: 6 }}>
                  {neta?.name} &middot; {neta?.party} &middot; {neta?.state} &middot;{" "}
                  <span className="num">{s.gp.toLocaleString("en-IN")}</span> GP &middot;{" "}
                  <span className="num">{s.duels.toLocaleString("en-IN")}</span> duels
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </SiteFrame>
  );
}
