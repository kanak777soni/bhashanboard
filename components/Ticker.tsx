import Link from "next/link";
import { getData } from "@/lib/data";

/**
 * The running head. Reports the true state of the record rather than
 * inventing activity: what is indexed, what is still missing, what was
 * refused. An archive that overstates its own completeness is worth less
 * than one that doesn't.
 */
export default async function Ticker() {
  const data = await getData();
  const inventory = data.publicInventory();
  const newFilings = inventory.liveVideos.filter(
    (statement) => statement.rating.validVoteCount === 0
  ).length;
  const placement = inventory.liveVideos.filter(
    (statement) =>
      statement.rating.validVoteCount > 0 &&
      statement.rating.validVoteCount < 10
  ).length;
  const researchFiles =
    inventory.videoUnderReview.length + inventory.researchOnly.length;
  const items = [
    {
      href: "/watch",
      text: `${inventory.liveVideos.length} verified video screenings open · ${newFilings} new · ${placement} in placement · ${inventory.rankedVideos.length} ranked`,
    },
    {
      href: "/record",
      text: `${researchFiles} research files · ${inventory.videoUnderReview.length} clips under review · ${inventory.researchOnly.length} awaiting verified footage`,
    },
    {
      href: "/record",
      text: `${data.STATS.withVerbatimQuote} of ${data.STATS.indexed} searchable entries carry an established verbatim quote — the rest use a neutral subject line`,
    },
    {
      href: "/rejected",
      text: `${data.REJECTED.length} proposed statements refused under the Rules, each recorded with the rule that killed it`,
    },
  ];

  const tickerGroup = (duplicate = false) => (
    <div className="ticker-group" aria-hidden={duplicate || undefined}>
      {items.map((item, index) => (
        <Link
          key={`${item.href}-${index}`}
          href={item.href}
          tabIndex={duplicate ? -1 : undefined}
        >
          {item.text}
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <Link
        className="ticker-mobile"
        href="/record"
        aria-label={`Record status: ${inventory.liveVideos.length} verified videos ready to rule; ${inventory.rankedVideos.length} ranked; ${researchFiles} research files`}
      >
        <span className="ticker-mobile-label">Record status</span>
        <span className="ticker-mobile-counts" aria-hidden="true">
          <span className="num">{inventory.liveVideos.length}</span> ready &middot;{" "}
          <span className="num">{inventory.rankedVideos.length}</span> ranked &middot;{" "}
          <span className="num">{researchFiles}</span> research
        </span>
      </Link>

      <div className="ticker ticker-desktop">
        <span className="ticker-tag">State of the record</span>
        <div className="ticker-viewport">
          <div className="ticker-track">
            {tickerGroup()}
            {tickerGroup(true)}
          </div>
        </div>
      </div>
    </>
  );
}
