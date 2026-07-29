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
      text: `${inventory.liveVideos.length} clips live · ${newFilings} fresh · ${placement} finding a place · ${inventory.rankedVideos.length} on the standings`,
    },
    {
      href: "/record",
      text: `${researchFiles} entries on deck · ${inventory.videoUnderReview.length} clips backstage · ${inventory.researchOnly.length} still need a clip`,
    },
    {
      href: "/duel",
      text:
        inventory.liveVideos.length >= 2
          ? "Aamne-Saamne is open · two statements enter · you pick the more magnificent one"
          : "Aamne-Saamne opens as soon as two clips are live",
    },
    {
      href: "/submit",
      text: "Found a speech that belongs here? Send a YouTube, Facebook or Instagram link",
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
        href="/watch"
        aria-label={`Board status: ${inventory.liveVideos.length} live clips; ${inventory.rankedVideos.length} on the standings; ${researchFiles} entries on deck`}
      >
        <span className="ticker-mobile-label">Board status</span>
        <span className="ticker-mobile-counts" aria-hidden="true">
          <span className="num">{inventory.liveVideos.length}</span> live &middot;{" "}
          <span className="num">{inventory.rankedVideos.length}</span> ranked &middot;{" "}
          <span className="num">{researchFiles}</span> on deck
        </span>
      </Link>

      <div className="ticker ticker-desktop">
        <span className="ticker-tag">On the Board</span>
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
