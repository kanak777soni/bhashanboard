import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import Medal from "@/components/Medal";
import EntryTitle from "@/components/EntryTitle";
import { getData } from "@/lib/data";
import { buildPublicInventory } from "@/lib/public-inventory";

export const metadata: Metadata = {
  title: "Hall of Fame",
  description: "Entries inducted from the live standings into the permanent gallery.",
};

export default async function HallPage() {
  const data = await getData();
  const inventory = buildPublicInventory(data.CORPUS);
  // Induction is an editorial honour, but its public display still depends
  // on the same evidence and ten-ruling bar as the standings. Seed scores
  // must never create a preview gallery.
  const inducted = inventory.rankedVideos.filter((s) => s.hallOfFame);

  return (
    <SiteFrame>
      <div className="sec-head" style={{ marginTop: 26 }}>
        <h1>Hall of Fame</h1>
        <span className="lbl">Retired hurt</span>
      </div>

      <p className="prose" style={{ marginTop: 16 }}>
        Once a year, roughly five all-time entries from the live standings join
        this permanent gallery. The score stays untouched; induction is an
        honour, not another vote.
      </p>
      <p className="prose">
        {inducted.length
          ? "Inducted below."
          : "The first eligible induction has not yet taken place. The gallery stays empty until a video-backed entry is publicly ranked and formally inducted."}
      </p>

      <div style={{ marginTop: 24, borderTop: "2px solid var(--ink)" }}>
        {inducted.length === 0 && (
          <div className="empty">
            No Hall of Fame entry is public yet.{" "}
            <Link href="/watch">Watch the live clips</Link> or{" "}
            <Link href="/record">browse the archive</Link>.
          </div>
        )}
        {inducted.map((s) => {
          const neta = data.netaBySlug(s.neta);
          const publicRank = inventory.publicRankBySlug.get(s.slug);
          return (
            <article className="hall-entry" key={s.slug}>
              <div className="hall-rank">
                <Medal gp={s.gp} size={28} />
                <div className="num" style={{ fontSize: 11, color: "var(--ink-45)", marginTop: 2 }}>
                  {publicRank ? `#${publicRank}` : ""}
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
                  <span className="num">{s.rating.validVoteCount.toLocaleString("en-IN")}</span> public votes
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
