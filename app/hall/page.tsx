import type { Metadata } from "next";
import Link from "next/link";
import ClassAward from "@/components/ClassAward";
import ClassLadder from "@/components/ClassLadder";
import SiteFrame from "@/components/SiteFrame";
import EntryTitle from "@/components/EntryTitle";
import { sarcasmSignature } from "@/components/SarcasmProfile";
import { getData } from "@/lib/data";
import { hallEligibility } from "@/lib/hall";

export const metadata: Metadata = {
  title: "Hall of Fame",
  description: "Entries inducted from the live standings into the permanent gallery.",
};

export default async function HallPage() {
  const data = await getData();
  const inventory = data.publicInventory();
  const inducted = inventory.rankedVideos.filter((s) => s.hallOfFame);
  const rankedRoad = inventory.rankedVideos
    .filter((statement) => !statement.hallOfFame)
    .slice(0, 6);
  const placementRoad =
    rankedRoad.length === 0
      ? [...inventory.liveVideos]
          .filter((statement) => statement.rating.validVoteCount < 10)
          .sort(
            (a, b) =>
              b.rating.validVoteCount - a.rating.validVoteCount ||
              a.slug.localeCompare(b.slug),
          )
          .slice(0, 6)
      : [];
  const road = rankedRoad.length > 0 ? rankedRoad : placementRoad;

  return (
    <SiteFrame>
      <section className="hall-hero" aria-labelledby="hall-title">
        <div className="hall-hero-copy">
          <span className="lbl">The permanent gallery</span>
          <h1 id="hall-title">Hall of Fame</h1>
          <p>
            Kohinoor is a public class. The Hall is the rarer honour: a
            permanent place for the moments the Board refuses to let disappear.
            The clip receives the honour, never the person.
          </p>
        </div>
        <dl className="hall-rule">
          <div>
            <dt>25</dt>
            <dd>valid public votes</dd>
          </div>
          <div>
            <dt>1,875+</dt>
            <dd>GP · Kohinoor Class</dd>
          </div>
          <div>
            <dt>1</dt>
            <dd>formal induction</dd>
          </div>
        </dl>
      </section>

      <section className="hall-gallery" aria-labelledby="hall-inducted">
        <div className="sec-head">
          <h2 id="hall-inducted">The inducted moments</h2>
          <span className="lbl">
            {inducted.length} permanent{" "}
            {inducted.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {inducted.length === 0 && (
          <div className="hall-empty">
            <span className="stamp foil">The first plinth is still empty</span>
            <h3>No moment has been inducted yet.</h3>
            <p>
              Until the first ceremony, the strongest public clips wait below
              with their paperwork in order.
            </p>
          </div>
        )}
        {inducted.length > 0 && (
          <div className="hall-card-grid">
            {inducted.map((statement) => {
              const neta = data.netaBySlug(statement.neta);
              const publicRank =
                inventory.publicRankBySlug.get(statement.slug) ?? 0;
              return (
                <article className="hall-card" key={statement.slug}>
                  <span className="hall-card-kicker">
                    Inducted moment &middot; public rank #{publicRank}
                  </span>
                  <Link
                    href={`/statement/${statement.slug}`}
                    className="hall-card-title"
                  >
                    <EntryTitle statement={statement} />
                  </Link>
                  <p className="entry-sub">
                    {neta?.name ?? "Representative"} &middot;{" "}
                    {statement.partyAtTime} &middot; {statement.category}
                  </p>
                  <ClassAward
                    gp={statement.gp}
                    validVoteCount={statement.rating.validVoteCount}
                    performance={statement.rating.performance}
                    rank={publicRank}
                    hallOfFame
                    signature={sarcasmSignature(statement.axes)}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="hall-road" aria-labelledby="hall-road-title">
        <div className="sec-head">
          <h2 id="hall-road-title">Road to the Hall</h2>
          <Link className="lbl" href="/standings">
            Open the full standings &rarr;
          </Link>
        </div>

        {road.length > 0 ? (
          <div className="hall-road-grid">
            {road.map((statement) => {
              const neta = data.netaBySlug(statement.neta);
              const publicRank =
                inventory.publicRankBySlug.get(statement.slug) ?? 0;
              const eligibility = hallEligibility(statement);
              const progress =
                statement.rating.validVoteCount < 10
                  ? `${10 - statement.rating.validVoteCount} more ${
                      10 - statement.rating.validVoteCount === 1
                        ? "vote"
                        : "votes"
                    } to receive a class`
                  : eligibility.eligible
                    ? "Eligible for formal induction"
                    : [
                        eligibility.remainingVotes > 0
                          ? `${eligibility.remainingVotes} more ${
                              eligibility.remainingVotes === 1
                                ? "vote"
                                : "votes"
                            }`
                          : "",
                        eligibility.remainingGp > 0
                          ? `${eligibility.remainingGp} GP to Kohinoor`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ");

              return (
                <article className="hall-road-card" key={statement.slug}>
                  <div>
                    <span className="lbl">
                      {eligibility.eligible
                        ? "Ready for the ceremony"
                        : "Still climbing"}
                    </span>
                    <Link
                      href={`/statement/${statement.slug}`}
                      className="hall-road-title"
                    >
                      <EntryTitle statement={statement} />
                    </Link>
                    <p className="entry-sub">
                      {neta?.name ?? "Representative"} &middot;{" "}
                      {statement.partyAtTime}
                    </p>
                  </div>
                  <ClassAward
                    gp={statement.gp}
                    validVoteCount={statement.rating.validVoteCount}
                    performance={statement.rating.performance}
                    rank={publicRank}
                    signature={{
                      label: "Logic Break",
                      value: statement.axes.logic,
                    }}
                  />
                  <p className="hall-road-progress">{progress}</p>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="hall-empty">
            <h3>The road is open.</h3>
            <p>
              No clip is live yet. Send the moment that should face the Board.
            </p>
            <Link className="btn seal" href="/submit">
              Send a clip
            </Link>
          </div>
        )}
      </section>

      <ClassLadder statements={inventory.rankedVideos} />
    </SiteFrame>
  );
}
