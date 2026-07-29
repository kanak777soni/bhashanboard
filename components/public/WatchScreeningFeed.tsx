"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import EntryTitle from "@/components/EntryTitle";
import StatementVotingPanel, {
  type PublicRatingSnapshot,
} from "@/components/StatementVotingPanel";
import type { Axes, StatementVideo } from "@/lib/types";
import styles from "./PublicInventory.module.css";

export interface WatchFeedEntry {
  statementId: string;
  slug: string;
  quote: string;
  neutralTitle: string;
  hasVerbatimQuote: boolean;
  quoteTranslation?: string;
  language: string;
  speakerName: string;
  partyCode: string;
  category: string;
  video: StatementVideo;
  videoUrl?: string;
  publicationEligible: true;
  initialRating: PublicRatingSnapshot;
  maturityLabel: string;
  publicRank: number;
  axes: Axes;
  hallOfFame: boolean;
}

export default function WatchScreeningFeed({
  entries,
  catalogueStart,
  catalogueTotal,
  previousPageHref,
  nextPageHref,
}: {
  entries: WatchFeedEntry[];
  catalogueStart: number;
  catalogueTotal: number;
  previousPageHref?: string;
  nextPageHref?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [shareNotice, setShareNotice] = useState("");
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const userNavigatedRef = useRef(false);
  const active = entries[activeIndex];

  const move = useCallback(
    (direction: -1 | 1) => {
      userNavigatedRef.current = true;
      setShareNotice("");
      setActiveIndex((current) =>
        Math.max(0, Math.min(entries.length - 1, current + direction))
      );
    },
    [entries.length]
  );

  useEffect(() => {
    if (!userNavigatedRef.current) return;
    headingRef.current?.focus({ preventScroll: true });
  }, [activeIndex]);

  const handleFeedKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const interactiveAncestor = target.closest(
        "a, button, input, select, textarea, video, audio, iframe, [role], [aria-controls], [contenteditable]:not([contenteditable='false']), [tabindex]:not([tabindex='-1'])"
      );
      if (
        target !== event.currentTarget &&
        interactiveAncestor &&
        interactiveAncestor !== event.currentTarget
      ) {
        return;
      }
      if (event.key === "ArrowRight" && activeIndex < entries.length - 1) {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowLeft" && activeIndex > 0) {
        event.preventDefault();
        move(-1);
      }
    },
    [activeIndex, entries.length, move]
  );

  const share = useCallback(async () => {
    if (!active) return;
    const url = new URL(`/statement/${active.slug}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: active.neutralTitle,
          text: "Watch this clip and score it on The Bhashan Board.",
          url,
        });
        setShareNotice("Shared.");
      } else {
        await navigator.clipboard.writeText(url);
        setShareNotice("Link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareNotice("Open the clip page to copy its address.");
    }
  }, [active]);

  if (!active) return null;

  const cataloguePosition = catalogueStart + activeIndex + 1;
  const atFirst = activeIndex === 0;
  const atLast = activeIndex === entries.length - 1;

  return (
    <section
      className={styles.watchFeed}
      aria-label="One-video voting feed"
      tabIndex={0}
      onKeyDown={handleFeedKeyDown}
    >
      <header className={styles.watchFeedHead}>
        <div>
          <span className={styles.eyebrow}>
            Public screening &middot; your ruling comes first
          </span>
          <h1 ref={headingRef} tabIndex={-1}>
            <EntryTitle statement={active} />
          </h1>
          {active.quoteTranslation && (
            <p className="quote-translation">
              <span className="lbl">English</span>
              {active.quoteTranslation}
            </p>
          )}
          <p>
            {active.speakerName} &middot; {active.partyCode} &middot;{" "}
            {active.category}
          </p>
        </div>
        <div className={styles.watchCounter} aria-live="polite">
          <span className="num">{cataloguePosition}</span>
          <span>/ {catalogueTotal}</span>
        </div>
      </header>

      <StatementVotingPanel
        key={active.statementId}
        statementId={active.statementId}
        video={active.video}
        videoUrl={active.videoUrl}
        publicationEligible={active.publicationEligible}
        initialRating={active.initialRating}
        authCallbackPath={`/statement/${active.slug}`}
        resultsMode="after-vote"
        resultAward={{
          axes: active.axes,
          hallOfFame: active.hallOfFame,
          publicRank: active.publicRank,
        }}
      />

      <div className={styles.watchControls}>
        <div className={styles.watchControlGroup}>
          {!atFirst ? (
            <button className="btn ghost" type="button" onClick={() => move(-1)}>
              &larr; Previous
            </button>
          ) : previousPageHref ? (
            <Link className="btn ghost" href={previousPageHref}>
              &larr; Earlier clips
            </Link>
          ) : (
            <span />
          )}
        </div>

        <div className={styles.watchUtilities}>
          <Link className="btn ghost" href={`/statement/${active.slug}`}>
            More about this clip
          </Link>
          <button className="btn ghost" type="button" onClick={() => void share()}>
            Share
          </button>
        </div>

        <div className={styles.watchControlGroup}>
          {!atLast ? (
            <button className="btn seal" type="button" onClick={() => move(1)}>
              Next clip &rarr;
            </button>
          ) : nextPageHref ? (
            <Link className="btn seal" href={nextPageHref}>
              More clips &rarr;
            </Link>
          ) : (
            <Link className="btn seal" href="/record">
              Browse the archive &rarr;
            </Link>
          )}
        </div>
      </div>

      <div className={styles.watchFoot}>
        <span className="lbl">
          One clip at a time &middot; arrow keys move between videos
        </span>
        <span className="lbl" aria-live="polite">
          {shareNotice ||
            (atLast && !nextPageHref
              ? "That is the lot — for now."
              : "Watch, vote, or skip.")}
        </span>
      </div>
    </section>
  );
}
