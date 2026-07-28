"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import type { StatementVideo } from "@/lib/types";

const BALLOT_OPTIONS = [
  { value: 0, label: "Flat", detail: "Did not land" },
  { value: 25, label: "Wry", detail: "A faint spark" },
  { value: 50, label: "Sharp", detail: "Cleanly delivered" },
  { value: 75, label: "Savage", detail: "Hard to recover from" },
  { value: 100, label: "Historic", detail: "Archive material" },
] as const;

type VoteValue = (typeof BALLOT_OPTIONS)[number]["value"];
type VoteDistribution = Record<VoteValue, number>;

export interface PublicRatingSnapshot {
  gp: number;
  performance: number;
  validVoteCount: number;
  distribution: VoteDistribution;
}

interface CurrentVote {
  voteId: string;
  value: VoteValue;
  excluded: boolean;
  createdAt: string;
}

interface WatchSessionView {
  id: string;
  creditedWatchMs: number;
  requiredWatchMs: number;
  qualificationProgress: number;
  qualified: boolean;
  watchReceiptId: string | null;
}

type WatchPlayerState = "playing" | "paused" | "ended";

interface WatchPlayerController {
  getCurrentTime(): number;
  getPlayerState(): WatchPlayerState;
  pause(): void;
}

interface YoutubePlayer {
  destroy(): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  pauseVideo(): void;
  playVideo(): void;
}

interface YoutubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string;
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: { target: YoutubePlayer }) => void;
        onStateChange: (event: { data: number; target: YoutubePlayer }) => void;
        onError: () => void;
      };
    }
  ) => YoutubePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
  };
}

declare global {
  interface Window {
    YT?: YoutubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YoutubeApi> | null = null;

function loadYoutubeApi(): Promise<YoutubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YoutubeApi>((resolve, reject) => {
    const priorReady = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      youtubeApiPromise = null;
      reject(new Error("The video player took too long to load."));
    }, 15_000);

    window.onYouTubeIframeAPIReady = () => {
      priorReady?.();
      window.clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("The video player could not be initialised."));
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        youtubeApiPromise = null;
        reject(new Error("The video player could not be loaded."));
      };
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

function playerStateName(state: number, api?: YoutubeApi): WatchPlayerState {
  if (api && state === api.PlayerState.PLAYING) return "playing";
  if (api && state === api.PlayerState.ENDED) return "ended";
  return "paused";
}

function emptyDistribution(): VoteDistribution {
  return { 0: 0, 25: 0, 50: 0, 75: 0, 100: 0 };
}

function messageFromPayload(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export default function StatementVotingPanel({
  statementId,
  video,
  videoUrl,
  publicationEligible,
  initialRating,
}: {
  statementId: string;
  video?: StatementVideo;
  /** Public custom-domain URL derived from an R2 object key; never a signed URL. */
  videoUrl?: string;
  publicationEligible: boolean;
  initialRating: PublicRatingSnapshot;
}) {
  const { data: authSession, isPending: authPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [playerStarted, setPlayerStarted] = useState(false);
  const [playbackStarting, setPlaybackStarting] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [watchSession, setWatchSession] = useState<WatchSessionView | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [voteStateReady, setVoteStateReady] = useState(false);
  const [currentVote, setCurrentVote] = useState<CurrentVote | null>(null);
  const [selectedVote, setSelectedVote] = useState<VoteValue | null>(null);
  const [rating, setRating] = useState(initialRating);
  const [submitting, setSubmitting] = useState(false);

  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<WatchPlayerController | null>(null);
  const nativeEndedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatInFlightRef = useRef(false);
  const sessionStartingRef = useRef(false);

  const user = authSession?.user;
  const votingEligible = publicationEligible;
  const canTrackWatch = votingEligible && user?.emailVerified === true && !currentVote;
  const qualified = Boolean(watchSession?.qualified && watchSession.watchReceiptId);
  const playbackGatePending =
    votingEligible &&
    (authPending || (user?.emailVerified === true && !voteStateReady));

  const publicRulingLabel = useMemo(() => {
    if (rating.validVoteCount === 0) return "Editorial seed · no public rulings yet";
    return `${rating.validVoteCount.toLocaleString("en-IN")} verified public ruling${
      rating.validVoteCount === 1 ? "" : "s"
    }`;
  }, [rating.validVoteCount]);

  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    let cancelled = false;
    if (!votingEligible || !user?.emailVerified) {
      setVoteStateReady(true);
      return;
    }

    setVoteStateReady(false);
    void fetch(`/api/statements/${encodeURIComponent(statementId)}/votes`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              state?: { currentUserVote?: CurrentVote | null; rating?: PublicRatingSnapshot | null };
            }
          | null;
        if (!response.ok) throw new Error(messageFromPayload(payload, "Your voting record could not be loaded."));
        if (cancelled) return;
        setCurrentVote(payload?.state?.currentUserVote ?? null);
        if (payload?.state?.rating) setRating(payload.state.rating);
      })
      .catch((error: unknown) => {
        if (!cancelled) setWatchError(error instanceof Error ? error.message : "Your voting record could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setVoteStateReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [statementId, user?.emailVerified, user?.id, votingEligible]);

  const sendHeartbeat = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    const player = playerRef.current;
    if (!sessionId || !player || heartbeatInFlightRef.current) return;

    heartbeatInFlightRef.current = true;
    try {
      const response = await fetch(`/api/watch-sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionSeconds: player.getCurrentTime(),
          playerState: player.getPlayerState(),
          visible: document.visibilityState === "visible",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; session?: WatchSessionView }
        | null;
      if (!response.ok || !payload?.session) {
        throw new Error(messageFromPayload(payload, "Playback progress could not be recorded."));
      }
      setWatchSession(payload.session);
      setWatchError(null);
    } catch (error) {
      setWatchError(error instanceof Error ? error.message : "Playback progress could not be recorded.");
    } finally {
      heartbeatInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (
      !playerStarted ||
      !video ||
      video.platform !== "youtube" ||
      !playerMountRef.current
    ) {
      return;
    }
    let disposed = false;
    let player: YoutubePlayer | null = null;
    let controller: WatchPlayerController | null = null;

    void loadYoutubeApi()
      .then((api) => {
        if (disposed || !playerMountRef.current) return;
        player = new api.Player(playerMountRef.current, {
          host: "https://www.youtube-nocookie.com",
          videoId: video.id,
          playerVars: {
            autoplay: 1,
            controls: 1,
            disablekb: 0,
            end: video.end,
            fs: 1,
            playsinline: 1,
            rel: 0,
            start: video.start,
          },
          events: {
            onReady: ({ target }) => {
              controller = {
                getCurrentTime: () => target.getCurrentTime(),
                getPlayerState: () => playerStateName(target.getPlayerState(), api),
                pause: () => target.pauseVideo(),
              };
              playerRef.current = controller;
              target.playVideo();
            },
            onStateChange: ({ data }) => {
              if (data === api.PlayerState.ENDED) void sendHeartbeat();
            },
            onError: () => setPlayerError("YouTube could not play this verified excerpt."),
          },
        });
      })
      .catch((error: unknown) => {
        if (!disposed) setPlayerError(error instanceof Error ? error.message : "The video player could not be loaded.");
      });

    return () => {
      disposed = true;
      if (playerRef.current === controller) playerRef.current = null;
      player?.destroy();
    };
  }, [playerStarted, sendHeartbeat, video]);

  useEffect(() => {
    if (
      !playerStarted ||
      !video ||
      video.platform !== "r2" ||
      !videoUrl ||
      !nativeVideoRef.current
    ) {
      return;
    }

    const element = nativeVideoRef.current;
    nativeEndedRef.current = false;
    const controller: WatchPlayerController = {
      getCurrentTime: () => element.currentTime,
      getPlayerState: () =>
        nativeEndedRef.current || element.ended
          ? "ended"
          : element.paused
            ? "paused"
            : "playing",
      pause: () => element.pause(),
    };
    playerRef.current = controller;

    const onLoadedMetadata = () => {
      const actualDurationMs = Math.round(element.duration * 1000);
      if (
        !Number.isFinite(element.duration) ||
        Math.abs(actualDurationMs - video.durationMs) > 1_500
      ) {
        element.pause();
        setPlayerError("The hosted video does not match its verified duration.");
        return;
      }
      element.currentTime = video.start;
      element.playbackRate = 1;
      void element.play().catch(() => {
        // Autoplay can be blocked after the server creates a watch session.
        // Native controls remain available for the user's next gesture.
      });
    };
    const onPlay = () => {
      nativeEndedRef.current = false;
      if (element.currentTime >= element.duration) element.currentTime = video.start;
      if (element.playbackRate !== 1) element.playbackRate = 1;
    };
    const onPause = () => void sendHeartbeat();
    const onSeeking = () => {
      nativeEndedRef.current = false;
      void sendHeartbeat();
    };
    const onEnded = () => {
      nativeEndedRef.current = true;
      void sendHeartbeat();
    };
    const onRateChange = () => {
      if (element.playbackRate !== 1) element.playbackRate = 1;
    };
    const onError = () => setPlayerError("The hosted MP4 could not be played.");

    element.addEventListener("loadedmetadata", onLoadedMetadata);
    element.addEventListener("play", onPlay);
    element.addEventListener("pause", onPause);
    element.addEventListener("seeking", onSeeking);
    element.addEventListener("ended", onEnded);
    element.addEventListener("ratechange", onRateChange);
    element.addEventListener("error", onError);

    // Metadata may already be available from the browser cache before this
    // effect attaches its listener.
    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) onLoadedMetadata();

    return () => {
      element.removeEventListener("loadedmetadata", onLoadedMetadata);
      element.removeEventListener("play", onPlay);
      element.removeEventListener("pause", onPause);
      element.removeEventListener("seeking", onSeeking);
      element.removeEventListener("ended", onEnded);
      element.removeEventListener("ratechange", onRateChange);
      element.removeEventListener("error", onError);
      element.pause();
      if (playerRef.current === controller) playerRef.current = null;
    };
  }, [playerStarted, sendHeartbeat, video, videoUrl]);

  useEffect(() => {
    if (!playerStarted || !canTrackWatch) return;
    const interval = window.setInterval(() => void sendHeartbeat(), 4_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        playerRef.current?.pause();
        void sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [canTrackWatch, playerStarted, sendHeartbeat]);

  async function startPlayback() {
    if (
      playerStarted ||
      playbackStarting ||
      playbackGatePending ||
      sessionStartingRef.current
    ) {
      return;
    }

    setPlayerError(null);
    setWatchError(null);
    if (video?.platform === "r2" && !videoUrl) {
      setPlayerError("The hosted video URL is not configured.");
      return;
    }
    if (!canTrackWatch || sessionIdRef.current) {
      setPlayerStarted(true);
      return;
    }

    setPlaybackStarting(true);
    sessionStartingRef.current = true;
    try {
      const response = await fetch("/api/watch-sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; session?: WatchSessionView }
        | null;
      if (!response.ok || !payload?.session) {
        throw new Error(
          messageFromPayload(
            payload,
            "A verified watch session could not be started."
          )
        );
      }

      // Establish the server clock before mounting the autoplaying iframe.
      sessionIdRef.current = payload.session.id;
      setWatchSession(payload.session);
      setPlayerStarted(true);
    } catch (error) {
      setWatchError(
        error instanceof Error
          ? error.message
          : "A verified watch session could not be started."
      );
    } finally {
      sessionStartingRef.current = false;
      setPlaybackStarting(false);
    }
  }

  async function submitVote() {
    if (selectedVote === null || !watchSession?.watchReceiptId || submitting) return;
    setSubmitting(true);
    setWatchError(null);
    try {
      const response = await fetch(`/api/statements/${encodeURIComponent(statementId)}/votes`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: selectedVote, watchReceiptId: watchSession.watchReceiptId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            result?: {
              vote: { id: string; value: VoteValue; createdAt: string };
              rating: PublicRatingSnapshot;
            };
          }
        | null;
      if (!response.ok || !payload?.result) {
        throw new Error(messageFromPayload(payload, "Your final ruling could not be recorded."));
      }
      setCurrentVote({
        voteId: payload.result.vote.id,
        value: payload.result.vote.value,
        excluded: false,
        createdAt: payload.result.vote.createdAt,
      });
      setRating(payload.result.rating);
      router.refresh();
    } catch (error) {
      setWatchError(error instanceof Error ? error.message : "Your final ruling could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  const watchProgress = Math.round((watchSession?.qualificationProgress ?? 0) * 100);

  return (
    <section className="ruling-panel" aria-labelledby={`ruling-${statementId}`}>
      <div className="ruling-head">
        <div>
          <span className="lbl">Verified footage &amp; public ruling</span>
          <h2 id={`ruling-${statementId}`}>Watch first. Rule once.</h2>
        </div>
        <div className="ruling-score" aria-label={`Current performance ${Math.round(rating.performance)} out of 100`}>
          <span className="num">{Math.round(rating.performance)}</span>
          <small>/ 100</small>
        </div>
      </div>

      <div className="performance-track" aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(100, rating.performance))}%` }} />
        <b style={{ left: `${Math.max(0, Math.min(100, rating.performance))}%` }} />
      </div>
      <div className="performance-legend lbl">
        <span>Flat</span>
        <span>{publicRulingLabel}</span>
        <span>Historic</span>
      </div>

      {video ? (
        playerStarted ? (
          <div className="player ruling-player">
            {video.platform === "youtube" ? (
              <div ref={playerMountRef} className="youtube-mount" />
            ) : (
              <video
                ref={nativeVideoRef}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                disablePictureInPicture
                disableRemotePlayback
                aria-label="Verified source excerpt"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  background: "#000",
                }}
              />
            )}
          </div>
        ) : (
          <button
            type="button"
            className="player ruling-player"
            onClick={() => void startPlayback()}
            disabled={playbackGatePending || playbackStarting}
            aria-label="Load and play the verified source excerpt"
          >
            <svg className="play-glyph" aria-hidden="true"><use href="#g-play" /></svg>
            <span className="note">
              Click to load · {video.platform === "r2" ? "hosted MP4" : "YouTube"} excerpt {video.start}s–{video.end}s
            </span>
          </button>
        )
      ) : (
        <div className="player ruling-player player-locked">
          <span className="lbl">No verified video excerpt is attached</span>
        </div>
      )}

      {playerError && <p className="ruling-alert" role="alert">{playerError}</p>}

      <div className="ballot-box">
        {!votingEligible ? (
          <p className="ruling-status">
            Voting is locked until the entry is placed, has a bounded video excerpt, and is marked committee-passed.
          </p>
        ) : authPending ? (
          <p className="ruling-status">Checking your membership…</p>
        ) : !user ? (
          <p className="ruling-status">
            The evidence is public. To enter a ruling, <Link href={`/sign-in?callbackURL=${encodeURIComponent(pathname)}`}>sign in</Link> or <Link href={`/sign-up?callbackURL=${encodeURIComponent(pathname)}`}>register</Link>.
          </p>
        ) : !user.emailVerified ? (
          <p className="ruling-status">
            Verify your email before a watch session can count. <Link href="/verify-email">Open verification.</Link>
          </p>
        ) : currentVote ? (
          <div className="ruling-final">
            <span className="stamp green">Ruling entered</span>
            <p>
              Your final position: <strong>{BALLOT_OPTIONS.find((option) => option.value === currentVote.value)?.label}</strong> ({currentVote.value}/100)
              {currentVote.excluded ? ". This ruling is preserved but excluded from the public calculation." : ". It cannot be edited or submitted again."}
            </p>
          </div>
        ) : !playerStarted ? (
          <p className="ruling-status">Play the verified excerpt to begin. At least 90% must be watched in this visible tab, including the end.</p>
        ) : !qualified ? (
          <div className="watch-progress">
            <div className="watch-progress-copy">
              <span className="lbl">Watch qualification</span>
              <span className="num">{watchProgress}%</span>
            </div>
            <div className="watch-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={watchProgress} aria-label="Verified watch progress">
              <i style={{ width: `${watchProgress}%` }} />
            </div>
            <p>Pausing is fine. Skipped, replayed, background-tab, and seeked time does not add credit.</p>
          </div>
        ) : (
          <div className="ballot-ready">
            <p className="ruling-status"><strong>Footage watched.</strong> Choose carefully: this is your one final ruling on this statement.</p>
            <div className="ballot-options" role="radiogroup" aria-label="Statement performance">
              {BALLOT_OPTIONS.map((option) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedVote === option.value}
                  className={selectedVote === option.value ? "selected" : undefined}
                  key={option.value}
                  onClick={() => setSelectedVote(option.value)}
                >
                  <b>{option.label}</b>
                  <span>{option.value}</span>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>
            <button type="button" className="btn seal ballot-submit" disabled={selectedVote === null || submitting} onClick={() => void submitVote()}>
              {submitting ? "Entering ruling…" : "Enter final ruling"}
            </button>
          </div>
        )}
        {watchError && <p className="ruling-alert" role="alert">{watchError}</p>}
      </div>

      {rating.validVoteCount > 0 && (
        <div className="vote-distribution" aria-label="Public ruling distribution">
          {BALLOT_OPTIONS.map((option) => {
            const count = rating.distribution?.[option.value] ?? emptyDistribution()[option.value];
            const width = rating.validVoteCount > 0 ? (count / rating.validVoteCount) * 100 : 0;
            return <i key={option.value} style={{ width: `${width}%` }} title={`${option.label}: ${count}`} />;
          })}
        </div>
      )}
    </section>
  );
}
