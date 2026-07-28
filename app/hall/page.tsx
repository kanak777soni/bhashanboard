import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import Medal from "@/components/Medal";
import EntryTitle from "@/components/EntryTitle";
import { getData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Hall of Fame",
  description: "Entries inducted from the live standings into the permanent gallery.",
};

export default async function HallPage() {
  const data = await getData();
  // Inducted entries are chosen by the Committee in the admin. Until the
  // first induction the gallery previews the standing candidates.
  const ranked = data.rankedStatements();
  const inducted = ranked.filter((s) => s.hallOfFame);
  const candidates = inducted.length ? inducted : ranked.filter((s) => s.gp >= 1875);

  return (
    <SiteFrame>
      <div className="sec-head" style={{ marginTop: 26 }}>
        <h1>Hall of Fame</h1>
        <span className="lbl">Retired hurt</span>
      </div>

      <p className="prose" style={{ marginTop: 16 }}>
        Once a year the Committee inducts roughly five all-time entries from the live standings into a
        permanent gallery. The rating record remains intact; induction is an editorial honour, not a vote.
      </p>
      <p className="prose">
{inducted.length ? "Inducted below." : "The first induction has not yet taken place. Standing candidates are shown below."}
      </p>

      <div style={{ marginTop: 24, borderTop: "2px solid var(--ink)" }}>
        {candidates.map((s, i) => {
          const neta = data.netaBySlug(s.neta);
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
                  {neta?.name} &middot; {s.partyAtTime} &middot; {neta?.state} &middot;{" "}
                  <span className="num">{s.rating.validVoteCount.toLocaleString("en-IN")}</span> public rulings
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
