"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StatementVideo } from "@/lib/types";

export type VerifiedVideoPlayerState = "playing" | "paused" | "ended";

export interface VerifiedVideoHeartbeat {
  positionSeconds: number;
  playerState: VerifiedVideoPlayerState;
}

export interface VerifiedVideoPlayerHandle {
  getHeartbeat(): VerifiedVideoHeartbeat;
  pause(): void;
  play(): void;
  restart(): void;
  setMuted(muted: boolean): void;
}

export type VerifiedVideoHeartbeatReason =
  | "pause"
  | "seeking"
  | "ended"
  | "unmount";

interface YoutubePlayer {
  destroy(): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  mute(): void;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  unMute(): void;
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
        onAutoplayBlocked: () => void;
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

function youtubeState(
  state: number,
  api: YoutubeApi
): VerifiedVideoPlayerState {
  if (state === api.PlayerState.PLAYING) return "playing";
  if (state === api.PlayerState.ENDED) return "ended";
  return "paused";
}

export default function VerifiedVideoPlayer({
  video,
  videoUrl,
  playbackAllowed,
  playbackPending = false,
  active = true,
  className = "player ruling-player",
  onPlaybackRequest,
  onControllerChange,
  onHeartbeat,
  onError,
}: {
  video: StatementVideo;
  /** Signed, version-pinned URL for an authenticated Cloudinary derivative. */
  videoUrl?: string;
  /**
   * False while a verified, eligible, unvoted viewer's server watch session is
   * being established. The media may load, but cannot begin playback.
   */
  playbackAllowed: boolean;
  playbackPending?: boolean;
  /** Feed views can set exactly one card active without changing player APIs. */
  active?: boolean;
  className?: string;
  onPlaybackRequest?: () => void | Promise<void>;
  onControllerChange?: (controller: VerifiedVideoPlayerHandle | null) => void;
  onHeartbeat?: (
    heartbeat: VerifiedVideoHeartbeat,
    reason: VerifiedVideoHeartbeatReason
  ) => void;
  onError?: (message: string) => void;
}) {
  const youtubeMountRef = useRef<HTMLDivElement | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const controllerRef = useRef<VerifiedVideoPlayerHandle | null>(null);
  const playbackAllowedRef = useRef(playbackAllowed);
  const activeRef = useRef(active);
  const onControllerChangeRef = useRef(onControllerChange);
  const onHeartbeatRef = useRef(onHeartbeat);
  const onErrorRef = useRef(onError);
  const autoplayTimerRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  playbackAllowedRef.current = playbackAllowed;
  activeRef.current = active;
  onControllerChangeRef.current = onControllerChange;
  onHeartbeatRef.current = onHeartbeat;
  onErrorRef.current = onError;

  const clearAutoplayTimer = useCallback(() => {
    if (autoplayTimerRef.current !== null) {
      window.clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, []);

  const publishController = useCallback(
    (controller: VerifiedVideoPlayerHandle | null) => {
      controllerRef.current = controller;
      onControllerChangeRef.current?.(controller);
    },
    []
  );

  const emitHeartbeat = useCallback(
    (
      heartbeat: VerifiedVideoHeartbeat,
      reason: VerifiedVideoHeartbeatReason
    ) => {
      onHeartbeatRef.current?.(heartbeat, reason);
    },
    []
  );

  const reportError = useCallback((message: string) => {
    onErrorRef.current?.(message);
  }, []);

  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setMuted(true);
    setAutoplayBlocked(false);
  }, [video.id, video.platform, video.start, video.end]);

  useEffect(() => {
    if (video.platform !== "youtube" || !youtubeMountRef.current) return;

    let disposed = false;
    let player: YoutubePlayer | null = null;
    let controller: VerifiedVideoPlayerHandle | null = null;

    const checkAutoplay = () => {
      clearAutoplayTimer();
      autoplayTimerRef.current = window.setTimeout(() => {
        if (
          !disposed &&
          playbackAllowedRef.current &&
          activeRef.current &&
          player?.getPlayerState() !== window.YT?.PlayerState.PLAYING
        ) {
          setAutoplayBlocked(true);
        }
      }, 3_500);
    };

    void loadYoutubeApi()
      .then((api) => {
        if (disposed || !youtubeMountRef.current) return;
        player = new api.Player(youtubeMountRef.current, {
          host: "https://www.youtube-nocookie.com",
          videoId: video.id,
          playerVars: {
            autoplay: playbackAllowedRef.current && activeRef.current ? 1 : 0,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            end: video.end,
            fs: 1,
            mute: 1,
            playsinline: 1,
            rel: 0,
            start: video.start,
          },
          events: {
            onReady: ({ target }) => {
              if (disposed) return;
              target.mute();
              setMuted(true);
              controller = {
                getHeartbeat: () => ({
                  positionSeconds: target.getCurrentTime(),
                  playerState: youtubeState(target.getPlayerState(), api),
                }),
                pause: () => target.pauseVideo(),
                play: () => {
                  setAutoplayBlocked(false);
                  target.playVideo();
                  checkAutoplay();
                },
                restart: () => {
                  target.pauseVideo();
                  target.seekTo(video.start, true);
                  target.mute();
                  setMuted(true);
                  setPlaying(false);
                  setAutoplayBlocked(false);
                },
                setMuted: (nextMuted) => {
                  if (nextMuted) target.mute();
                  else target.unMute();
                  setMuted(nextMuted);
                },
              };
              publishController(controller);
              setReady(true);
              if (playbackAllowedRef.current && activeRef.current) {
                controller.play();
              }
            },
            onStateChange: ({ data, target }) => {
              if (disposed) return;
              const state = youtubeState(data, api);
              if (state === "playing") {
                if (!playbackAllowedRef.current || !activeRef.current) {
                  target.pauseVideo();
                  return;
                }
                clearAutoplayTimer();
                setAutoplayBlocked(false);
                setPlaying(true);
                return;
              }

              setPlaying(false);
              if (state === "ended") {
                clearAutoplayTimer();
                emitHeartbeat(
                  {
                    positionSeconds: target.getCurrentTime(),
                    playerState: "ended",
                  },
                  "ended"
                );
              } else if (data === api.PlayerState.PAUSED) {
                emitHeartbeat(
                  {
                    positionSeconds: target.getCurrentTime(),
                    playerState: "paused",
                  },
                  "pause"
                );
              }
            },
            onAutoplayBlocked: () => {
              if (disposed) return;
              clearAutoplayTimer();
              if (playbackAllowedRef.current && activeRef.current) {
                setAutoplayBlocked(true);
              }
            },
            onError: () => {
              if (!disposed) {
                reportError("YouTube could not play this verified excerpt.");
              }
            },
          },
        });
      })
      .catch((error: unknown) => {
        if (!disposed) {
          reportError(
            error instanceof Error
              ? error.message
              : "The video player could not be loaded."
          );
        }
      });

    return () => {
      disposed = true;
      clearAutoplayTimer();
      if (controller) {
        const heartbeat = controller.getHeartbeat();
        emitHeartbeat(
          {
            ...heartbeat,
            playerState:
              heartbeat.playerState === "ended" ? "ended" : "paused",
          },
          "unmount"
        );
        controller.pause();
      }
      if (controllerRef.current === controller) publishController(null);
      player?.destroy();
    };
  }, [
    clearAutoplayTimer,
    emitHeartbeat,
    publishController,
    reportError,
    video.end,
    video.id,
    video.platform,
    video.start,
  ]);

  useEffect(() => {
    if (video.platform !== "cloudinary") return;
    if (!videoUrl) {
      reportError("The hosted video URL is not configured.");
      return;
    }
    if (!nativeVideoRef.current) return;

    const element = nativeVideoRef.current;
    let disposed = false;
    let ended = false;
    let metadataChecked = false;

    const attemptPlay = () => {
      if (disposed || !playbackAllowedRef.current || !activeRef.current) {
        return;
      }
      setAutoplayBlocked(false);
      void element.play().catch(() => {
        if (!disposed && playbackAllowedRef.current && activeRef.current) {
          setAutoplayBlocked(true);
        }
      });
    };

    const controller: VerifiedVideoPlayerHandle = {
      getHeartbeat: () => ({
        positionSeconds: element.currentTime,
        playerState:
          ended || element.ended
            ? "ended"
            : element.paused
              ? "paused"
              : "playing",
      }),
      pause: () => element.pause(),
      play: attemptPlay,
      restart: () => {
        element.pause();
        ended = false;
        element.currentTime = video.start;
        element.muted = true;
        setMuted(true);
        setPlaying(false);
        setAutoplayBlocked(false);
      },
      setMuted: (nextMuted) => {
        element.muted = nextMuted;
        setMuted(nextMuted);
      },
    };
    publishController(controller);

    const onLoadedMetadata = () => {
      if (metadataChecked) return;
      metadataChecked = true;
      const actualDurationMs = Math.round(element.duration * 1000);
      if (
        !Number.isFinite(element.duration) ||
        Math.abs(actualDurationMs - video.durationMs) > 1_500
      ) {
        element.pause();
        reportError("The hosted video does not match its verified duration.");
        return;
      }
      element.currentTime = video.start;
      element.playbackRate = 1;
      element.muted = true;
      setMuted(true);
      setReady(true);
      attemptPlay();
    };
    const onPlay = () => {
      if (!playbackAllowedRef.current || !activeRef.current) {
        element.pause();
        return;
      }
      ended = false;
      if (element.currentTime >= element.duration) {
        element.currentTime = video.start;
      }
      if (element.playbackRate !== 1) element.playbackRate = 1;
      setAutoplayBlocked(false);
      setPlaying(true);
    };
    const onPause = () => {
      setPlaying(false);
      emitHeartbeat(
        {
          positionSeconds: element.currentTime,
          playerState: "paused",
        },
        "pause"
      );
    };
    const onSeeking = () => {
      ended = false;
      emitHeartbeat(controller.getHeartbeat(), "seeking");
    };
    const onEnded = () => {
      ended = true;
      setPlaying(false);
      emitHeartbeat(
        {
          positionSeconds: element.currentTime,
          playerState: "ended",
        },
        "ended"
      );
    };
    const onRateChange = () => {
      if (element.playbackRate !== 1) element.playbackRate = 1;
    };
    const onVolumeChange = () => setMuted(element.muted);
    const onError = () => reportError("The hosted MP4 could not be played.");

    element.addEventListener("loadedmetadata", onLoadedMetadata);
    element.addEventListener("play", onPlay);
    element.addEventListener("pause", onPause);
    element.addEventListener("seeking", onSeeking);
    element.addEventListener("ended", onEnded);
    element.addEventListener("ratechange", onRateChange);
    element.addEventListener("volumechange", onVolumeChange);
    element.addEventListener("error", onError);

    // The browser cache can satisfy metadata before this effect attaches.
    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) onLoadedMetadata();

    return () => {
      disposed = true;
      const heartbeat = controller.getHeartbeat();
      emitHeartbeat(
        {
          ...heartbeat,
          playerState:
            heartbeat.playerState === "ended" ? "ended" : "paused",
        },
        "unmount"
      );
      element.removeEventListener("loadedmetadata", onLoadedMetadata);
      element.removeEventListener("play", onPlay);
      element.removeEventListener("pause", onPause);
      element.removeEventListener("seeking", onSeeking);
      element.removeEventListener("ended", onEnded);
      element.removeEventListener("ratechange", onRateChange);
      element.removeEventListener("volumechange", onVolumeChange);
      element.removeEventListener("error", onError);
      element.pause();
      if (controllerRef.current === controller) publishController(null);
    };
  }, [
    emitHeartbeat,
    publishController,
    reportError,
    video,
    videoUrl,
  ]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (!playbackAllowed || !active) {
      controller.pause();
      return;
    }
    if (!ready) return;
    controller.play();
  }, [active, playbackAllowed, ready]);

  const requestPlayback = useCallback(async () => {
    if (!playbackAllowedRef.current) {
      await onPlaybackRequest?.();
      return;
    }
    controllerRef.current?.play();
  }, [onPlaybackRequest]);

  const toggleSound = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller || !playbackAllowedRef.current) return;
    const nextMuted = !muted;
    controller.setMuted(nextMuted);
    if (!nextMuted && autoplayBlocked) controller.play();
  }, [autoplayBlocked, muted]);

  const interactionAllowed = playbackAllowed && active;
  const gateVisible = active && !playbackAllowed;
  const fallbackVisible = gateVisible || autoplayBlocked;
  const fallbackLabel = gateVisible
    ? playbackPending
      ? "Preparing verified watch\u2026"
      : "Tap to prepare verified playback"
    : "Tap to play";

  return (
    <div className={className} aria-busy={playbackPending || !ready}>
      {video.platform === "youtube" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: interactionAllowed ? "auto" : "none",
          }}
          inert={!interactionAllowed ? true : undefined}
          aria-hidden={!interactionAllowed}
        >
          <div ref={youtubeMountRef} className="youtube-mount" />
        </div>
      ) : (
        <video
          ref={nativeVideoRef}
          src={videoUrl}
          controls={interactionAllowed}
          autoPlay={playbackAllowed && active}
          muted={muted}
          playsInline
          preload={active ? "auto" : "metadata"}
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

      {fallbackVisible && (
        <button
          type="button"
          onClick={() => void requestPlayback()}
          disabled={playbackPending}
          aria-label={fallbackLabel}
          style={{
            appearance: "none",
            position: "absolute",
            inset: 0,
            zIndex: 3,
            width: "100%",
            border: 0,
            background: "rgba(11, 16, 13, .72)",
            color: "rgba(220, 227, 212, .9)",
            cursor: playbackPending ? "wait" : "pointer",
          }}
        >
          {!playbackPending && (
            <svg className="play-glyph" aria-hidden="true">
              <use href="#g-play" />
            </svg>
          )}
          <span className="note">{fallbackLabel}</span>
        </button>
      )}

      {playing && !fallbackVisible && (
        <button
          type="button"
          className="btn seal"
          onClick={toggleSound}
          aria-label={muted ? "Turn video sound on" : "Mute video"}
          aria-pressed={!muted}
          style={{
            position: "absolute",
            zIndex: 2,
            top: 10,
            right: 10,
            padding: "6px 10px",
          }}
        >
          {muted ? "Tap for sound" : "Mute"}
        </button>
      )}
    </div>
  );
}
