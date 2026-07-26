"use client";

import { useState } from "react";

/**
 * Embed facade. A YouTube iframe is roughly 700KB; a standings page with
 * twenty of them is unusable on Indian 4G. Render a poster and a play
 * glyph, and load the real iframe only on click — a ~95% cut to initial
 * payload and the highest-impact performance decision on the site
 * (docs/08-information-architecture.md §8.6).
 *
 * Never autoplay: data costs the user money.
 */
export default function ClipFacade({ videoId, start, end }: { videoId?: string; start?: number; end?: number }) {
  const [live, setLive] = useState(false);

  if (live && videoId) {
    const params = new URLSearchParams({ autoplay: "1", rel: "0" });
    if (start != null) params.set("start", String(start));
    if (end != null) params.set("end", String(end));
    return (
      <div className="player">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?${params}`}
          title="Source clip"
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      </div>
    );
  }

  return (
    <button type="button" className="player" onClick={() => setLive(true)} aria-label="Play the source clip">
      <svg className="play-glyph" aria-hidden="true">
        <use href="#g-play" />
      </svg>
      <span className="note">
        {videoId ? "Click to load — nothing is fetched until you do" : "Facade — no source attached in seed data"}
      </span>
    </button>
  );
}
