"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import ClassAward from "@/components/ClassAward";
import SarcasmProfile from "@/components/SarcasmProfile";
import VerifiedVideoPlayer, {
  type VerifiedVideoHeartbeat,
  type VerifiedVideoHeartbeatReason,
  type VerifiedVideoPlayerHandle,
} from "@/components/VerifiedVideoPlayer";
import { useSession } from "@/lib/auth-client";
import {
  createLatestTaskQueue,
  type LatestTaskQueue,
} from "@/lib/latest-task-queue";
import {
  nextBallotIndex,
  resolvePlaybackPolicy,
  watchSessionErrorDisposition,
} from "@/lib/playback-policy";
import { SARCASM_LENSES, sarcasmHighlights } from "@/lib/sarcasm";
import type { Axes, StatementVideo } from "@/lib/types";

const BALLOT_OPTIONS = [
  { value: 0, label: "Flat", detail: "Nothing lands" },
  { value: 25, label: "Wry", detail: "A small spark" },
  { value: 50, label: "Sharp", detail: "Several parts land" },
  { value: 75, label: "Savage", detail: "The whole moment hits" },
  { value: 100, label: "Historic", detail: "Instant archive material" },
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

interface QueuedHeartbeat extends VerifiedVideoHeartbeat {
  contextKey: string;
  sessionId: string;
  visible: boolean;
  keepalive: boolean;
}

interface ContextError {
  contextKey: string;
  code: string | null;
  message: string;
}

interface VoteLookupState {
  contextKey: string;
  userId: string;
  ready: boolean;
  failed: boolean;
  currentVote: CurrentVote | null;
}

interface BoundWatchSession {
  contextKey: string;
  session: WatchSessionView;
}

interface SessionBinding {
  contextKey: string;
  sessionId: string;
}

interface AsyncAttempt {
  id: number;
  contextKey: string;
  controller: AbortController;
}

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function emptyDistribution(): VoteDistribution {
  return { 0: 0, 25: 0, 50: 0, 75: 0, 100: 0 };
}

function apiErrorFromPayload(
  payload: unknown,
  fallback: string,
  status: number
): ApiRequestError {
  if (!payload || typeof payload !== "object") {
    return new ApiRequestError(fallback, null, status);
  }
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") {
    return new ApiRequestError(fallback, null, status);
  }
  const message = (error as { message?: unknown }).message;
  const code = (error as { code?: unknown }).code;
  return new ApiRequestError(
    typeof message === "string" && message.trim() ? message : fallback,
    typeof code === "string" && code.trim() ? code : null,
    status
  );
}

function unknownRequestError(error: unknown, fallback: string): ApiRequestError {
  if (error instanceof ApiRequestError) return error;
  return new ApiRequestError(
    error instanceof Error && error.message ? error.message : fallback,
    null,
    0
  );
}

export default function StatementVotingPanel({
  statementId,
  video,
  videoUrl,
  publicationEligible,
  initialRating,
  active = true,
  authCallbackPath,
  resultsMode = "always",
  resultAward,
}: {
  statementId: string;
  video?: StatementVideo;
  /** Signed, version-pinned URL for an authenticated Cloudinary derivative. */
  videoUrl?: string;
  publicationEligible: boolean;
  initialRating: PublicRatingSnapshot;
  /** Feed views set exactly one visible card active at a time. */
  active?: boolean;
  /** Preserve the selected feed clip across sign-in. */
  authCallbackPath?: string;
  /** Watch can keep aggregate results blind until this member has voted. */
  resultsMode?: "always" | "after-vote";
  /** Optional Watch-only award reveal shown after the blind ballot. */
  resultAward?: {
    axes: Axes;
    hallOfFame?: boolean;
    publicRank?: number;
  };
}) {
  const { data: authSession, isPending: authPending } = useSession();
  const pathname = usePathname();
  const callbackPath = authCallbackPath ?? pathname;
  const router = useRouter();
  const user = authSession?.user;
  const authContextKey = authPending
    ? `pending:${user?.id ?? "guest"}:${user?.emailVerified === true ? "verified" : "unverified"}`
    : user
      ? `user:${user.id}:${user.emailVerified === true ? "verified" : "unverified"}`
      : "guest";
  const verifiedUserId =
    !authPending && user?.emailVerified === true ? user.id : null;

  const [playbackStartingContext, setPlaybackStartingContext] = useState<
    string | null
  >(null);
  const [playerErrorState, setPlayerErrorState] =
    useState<ContextError | null>(null);
  const [watchSessionState, setWatchSessionState] =
    useState<BoundWatchSession | null>(null);
  const [watchSessionUnavailableContext, setWatchSessionUnavailableContext] =
    useState<string | null>(null);
  const [watchErrorState, setWatchErrorState] =
    useState<ContextError | null>(null);
  const [voteLookup, setVoteLookup] = useState<VoteLookupState | null>(null);
  const [voteLookupRequestVersion, setVoteLookupRequestVersion] = useState(0);
  const [selectionState, setSelectionState] = useState<{
    contextKey: string;
    value: VoteValue | null;
  } | null>(null);
  const [rating, setRating] = useState(initialRating);
  const [submittingContext, setSubmittingContext] = useState<string | null>(
    null
  );

  const playerRef = useRef<VerifiedVideoPlayerHandle | null>(null);
  const sessionBindingRef = useRef<SessionBinding | null>(null);
  const sessionStartingRef = useRef<AsyncAttempt | null>(null);
  const voteSubmitAttemptRef = useRef<AsyncAttempt | null>(null);
  const attemptSequenceRef = useRef(0);
  const authContextKeyRef = useRef(authContextKey);
  const previousAuthContextKeyRef = useRef(authContextKey);
  const activeRef = useRef(active);
  const playbackAllowedRef = useRef(false);
  const mountedRef = useRef(false);
  const ballotButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const heartbeatQueueRef = useRef<LatestTaskQueue<QueuedHeartbeat> | null>(
    null
  );

  authContextKeyRef.current = authContextKey;
  activeRef.current = active;
  const votingEligible = publicationEligible;
  const voteLookupMatches =
    verifiedUserId !== null &&
    voteLookup?.contextKey === authContextKey &&
    voteLookup.userId === verifiedUserId;
  const voteStateReady =
    !votingEligible || verifiedUserId === null
      ? true
      : Boolean(voteLookupMatches && voteLookup?.ready);
  const currentVote = voteLookupMatches ? voteLookup?.currentVote ?? null : null;
  const voteLookupFailed = Boolean(voteLookupMatches && voteLookup?.failed);
  const watchSession =
    watchSessionState?.contextKey === authContextKey
      ? watchSessionState.session
      : null;
  const watchSessionUnavailable =
    watchSessionUnavailableContext === authContextKey;
  const playbackStarting = playbackStartingContext === authContextKey;
  const playerError =
    playerErrorState?.contextKey === authContextKey ? playerErrorState : null;
  const watchError =
    watchErrorState?.contextKey === authContextKey ? watchErrorState : null;
  const selectedVote =
    selectionState?.contextKey === authContextKey
      ? selectionState.value
      : null;
  const submitting = submittingContext === authContextKey;
  const playbackPolicy = resolvePlaybackPolicy({
    publicationEligible: votingEligible,
    authPending,
    signedIn: Boolean(user),
    emailVerified: user?.emailVerified === true,
    voteStateReady,
    hasCurrentVote: Boolean(currentVote),
    hasWatchSession: Boolean(watchSession?.id),
    watchSessionUnavailable,
  });
  const { canTrackWatch } = playbackPolicy;
  const qualified = Boolean(watchSession?.qualified && watchSession.watchReceiptId);
  const playbackGatePending = playbackPolicy.gatePending;
  const playbackAllowed = playbackPolicy.playbackAllowed;
  playbackAllowedRef.current = playbackAllowed;
  const hasPublicRulings = rating.validVoteCount > 0;
  const revealPublicResults =
    resultsMode === "always" || Boolean(currentVote);
  const displayedPerformance = hasPublicRulings && revealPublicResults
    ? Math.max(0, Math.min(100, rating.performance))
    : 0;

  const publicRulingLabel = useMemo(() => {
    if (!revealPublicResults) return "Results reveal after your vote";
    if (rating.validVoteCount === 0) return "Fresh clip · no votes yet";
    if (rating.validVoteCount < 10) {
      return `${rating.validVoteCount}/10 votes · finding its place`;
    }
    return `${rating.validVoteCount.toLocaleString("en-IN")} public vote${
      rating.validVoteCount === 1 ? "" : "s"
    }`;
  }, [rating.validVoteCount, revealPublicResults]);

  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const sessionAttempt = sessionStartingRef.current;
      sessionStartingRef.current = null;
      sessionAttempt?.controller.abort();
      const voteAttempt = voteSubmitAttemptRef.current;
      voteSubmitAttemptRef.current = null;
      voteAttempt?.controller.abort();
    };
  }, []);

  useEffect(() => {
    if (previousAuthContextKeyRef.current === authContextKey) return;
    previousAuthContextKeyRef.current = authContextKey;

    sessionStartingRef.current?.controller.abort();
    sessionStartingRef.current = null;
    voteSubmitAttemptRef.current?.controller.abort();
    voteSubmitAttemptRef.current = null;
    sessionBindingRef.current = null;

    setPlaybackStartingContext(null);
    setPlayerErrorState(null);
    setWatchSessionState(null);
    setWatchSessionUnavailableContext(null);
    setWatchErrorState(null);
    setVoteLookup(null);
    setSelectionState(null);
    setSubmittingContext(null);

    const player = playerRef.current;
    if (votingEligible && player) {
      player.restart();
      player.pause();
      if (playbackAllowedRef.current && activeRef.current) player.play();
    }
  }, [authContextKey, votingEligible]);

  useEffect(() => {
    if (!votingEligible || !verifiedUserId) {
      setVoteLookup(null);
      return;
    }

    const contextKey = authContextKey;
    const userId = verifiedUserId;
    const controller = new AbortController();
    setVoteLookup({
      contextKey,
      userId,
      ready: false,
      failed: false,
      currentVote: null,
    });

    void (async () => {
      try {
        const response = await fetch(
          `/api/statements/${encodeURIComponent(statementId)}/votes`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              state?: { currentUserVote?: CurrentVote | null; rating?: PublicRatingSnapshot | null };
            }
          | null;
        if (!response.ok) {
          throw apiErrorFromPayload(
            payload,
            "Your voting record could not be loaded.",
            response.status
          );
        }
        if (
          controller.signal.aborted ||
          authContextKeyRef.current !== contextKey
        ) {
          return;
        }
        setVoteLookup({
          contextKey,
          userId,
          ready: true,
          failed: false,
          currentVote: payload?.state?.currentUserVote ?? null,
        });
        if (payload?.state?.rating) setRating(payload.state.rating);
      } catch (error) {
        if (
          controller.signal.aborted ||
          authContextKeyRef.current !== contextKey
        ) {
          return;
        }
        const requestError = unknownRequestError(
          error,
          "Your voting record could not be loaded."
        );
        setVoteLookup({
          contextKey,
          userId,
          ready: true,
          failed: true,
          currentVote: null,
        });
        // An unknown prior-vote state must never open a tracked watch. Keep
        // evidence public, explicitly uncredited, until this lookup succeeds.
        setWatchSessionUnavailableContext(contextKey);
        setWatchErrorState({
          contextKey,
          code: requestError.code,
          message: requestError.message,
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    authContextKey,
    statementId,
    verifiedUserId,
    voteLookupRequestVersion,
    votingEligible,
  ]);

  const invalidateWatchSession = useCallback(
    (heartbeat: QueuedHeartbeat, error: ApiRequestError) => {
      const binding = sessionBindingRef.current;
      if (
        !mountedRef.current ||
        authContextKeyRef.current !== heartbeat.contextKey ||
        binding?.contextKey !== heartbeat.contextKey ||
        binding.sessionId !== heartbeat.sessionId
      ) {
        return;
      }

      // Clear authorization before resetting media so pause/seek events cannot
      // be attached to the terminal session.
      sessionBindingRef.current = null;
      setWatchSessionState(null);
      setWatchSessionUnavailableContext(heartbeat.contextKey);
      setSelectionState(null);
      setWatchErrorState({
        contextKey: heartbeat.contextKey,
        code: error.code,
        message: error.message,
      });
      playerRef.current?.restart();
      playerRef.current?.pause();
    },
    []
  );

  if (!heartbeatQueueRef.current) {
    heartbeatQueueRef.current = createLatestTaskQueue<QueuedHeartbeat>(
      async (heartbeat) => {
        const currentBinding = sessionBindingRef.current;
        if (
          authContextKeyRef.current !== heartbeat.contextKey ||
          currentBinding?.contextKey !== heartbeat.contextKey ||
          currentBinding.sessionId !== heartbeat.sessionId
        ) {
          return;
        }

        try {
          const response = await fetch(
            `/api/watch-sessions/${encodeURIComponent(heartbeat.sessionId)}`,
            {
              method: "PATCH",
              credentials: "same-origin",
              keepalive: heartbeat.keepalive,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                positionSeconds: heartbeat.positionSeconds,
                playerState: heartbeat.playerState,
                visible: heartbeat.visible,
              }),
            }
          );
          const payload = (await response.json().catch(() => null)) as
            | { ok?: boolean; session?: WatchSessionView }
            | null;
          if (!response.ok || !payload?.session) {
            throw apiErrorFromPayload(
              payload,
              "Playback progress could not be recorded.",
              response.status
            );
          }
          const binding = sessionBindingRef.current;
          if (
            mountedRef.current &&
            authContextKeyRef.current === heartbeat.contextKey &&
            binding?.contextKey === heartbeat.contextKey &&
            binding.sessionId === heartbeat.sessionId
          ) {
            setWatchSessionState({
              contextKey: heartbeat.contextKey,
              session: payload.session,
            });
            setWatchErrorState(null);
          }
        } catch (error) {
          const binding = sessionBindingRef.current;
          if (
            !mountedRef.current ||
            authContextKeyRef.current !== heartbeat.contextKey ||
            binding?.contextKey !== heartbeat.contextKey ||
            binding.sessionId !== heartbeat.sessionId
          ) {
            return;
          }
          const requestError = unknownRequestError(
            error,
            "Playback progress could not be recorded."
          );
          if (watchSessionErrorDisposition(requestError.code) === "reset") {
            invalidateWatchSession(heartbeat, requestError);
            return;
          }
          setWatchErrorState({
            contextKey: heartbeat.contextKey,
            code: requestError.code,
            message: requestError.message,
          });
        }
      }
    );
  }

  const heartbeatJob = useCallback(
    (
      heartbeat: VerifiedVideoHeartbeat | undefined,
      keepalive: boolean
    ): QueuedHeartbeat | null => {
      const binding = sessionBindingRef.current;
      const sample = heartbeat ?? playerRef.current?.getHeartbeat();
      if (
        !binding ||
        binding.contextKey !== authContextKeyRef.current ||
        !sample
      ) {
        return null;
      }
      return {
        contextKey: binding.contextKey,
        sessionId: binding.sessionId,
        ...sample,
        visible: document.visibilityState === "visible",
        keepalive,
      };
    },
    []
  );

  const enqueueHeartbeat = useCallback(
    (heartbeat?: VerifiedVideoHeartbeat) => {
      const job = heartbeatJob(heartbeat, false);
      return job
        ? heartbeatQueueRef.current!.enqueue(job)
        : Promise.resolve();
    },
    [heartbeatJob]
  );

  const flushHeartbeat = useCallback(
    (heartbeat?: VerifiedVideoHeartbeat) => {
      const job = heartbeatJob(heartbeat, true);
      return job
        ? heartbeatQueueRef.current!.flush(job)
        : heartbeatQueueRef.current!.flush();
    },
    [heartbeatJob]
  );

  const handlePlayerHeartbeat = useCallback(
    (
      heartbeat: VerifiedVideoHeartbeat,
      reason: VerifiedVideoHeartbeatReason
    ) => {
      if (reason === "seeking") {
        void enqueueHeartbeat(heartbeat);
      } else {
        // Pause, end, and unmount are terminal edges for the current playing
        // interval. Serialize and keep them alive through navigation.
        void flushHeartbeat(heartbeat);
      }
    },
    [enqueueHeartbeat, flushHeartbeat]
  );

  const handlePlayerChange = useCallback(
    (player: VerifiedVideoPlayerHandle | null) => {
      playerRef.current = player;
    },
    []
  );

  const handlePlayerError = useCallback((message: string) => {
    setPlayerErrorState({
      contextKey: authContextKeyRef.current,
      code: null,
      message,
    });
  }, []);

  const selectVote = useCallback((value: VoteValue) => {
    setSelectionState({
      contextKey: authContextKeyRef.current,
      value,
    });
  }, []);

  const handleBallotKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const nextIndex = nextBallotIndex(
        currentIndex,
        event.key,
        BALLOT_OPTIONS.length
      );
      if (nextIndex === null) return;
      event.preventDefault();
      selectVote(BALLOT_OPTIONS[nextIndex].value);
      ballotButtonRefs.current[nextIndex]?.focus();
    },
    [selectVote]
  );

  const retryVoteLookup = useCallback(() => {
    const contextKey = authContextKey;
    if (
      !verifiedUserId ||
      authContextKeyRef.current !== contextKey ||
      !voteLookupFailed
    ) {
      return;
    }
    playerRef.current?.pause();
    setWatchSessionUnavailableContext(null);
    setWatchErrorState(null);
    setVoteLookup({
      contextKey,
      userId: verifiedUserId,
      ready: false,
      failed: false,
      currentVote: null,
    });
    setVoteLookupRequestVersion((version) => version + 1);
  }, [authContextKey, verifiedUserId, voteLookupFailed]);

  const startPlayback = useCallback(async () => {
    const contextKey = authContextKey;
    const currentBinding = sessionBindingRef.current;
    if (
      authContextKeyRef.current !== contextKey ||
      playbackGatePending ||
      sessionStartingRef.current !== null ||
      currentBinding !== null ||
      !canTrackWatch ||
      voteLookupFailed ||
      !active ||
      !verifiedUserId
    ) {
      return;
    }
    setPlayerErrorState(null);
    setWatchErrorState(null);
    setWatchSessionUnavailableContext(null);
    if (video?.platform === "cloudinary" && !videoUrl) {
      setPlayerErrorState({
        contextKey,
        code: "VIDEO_URL_MISSING",
        message: "The hosted video URL is not configured.",
      });
      return;
    }

    if (watchSessionUnavailable) playerRef.current?.pause();
    const controller = new AbortController();
    const attempt: AsyncAttempt = {
      id: ++attemptSequenceRef.current,
      contextKey,
      controller,
    };
    sessionStartingRef.current = attempt;
    setPlaybackStartingContext(contextKey);
    try {
      const response = await fetch("/api/watch-sessions", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; session?: WatchSessionView }
        | null;
      if (!response.ok || !payload?.session) {
        throw apiErrorFromPayload(
          payload,
          "Your watch could not be started.",
          response.status
        );
      }
      if (
        controller.signal.aborted ||
        authContextKeyRef.current !== contextKey ||
        sessionStartingRef.current !== attempt
      ) {
        return;
      }

      if (watchSessionUnavailable && !payload.session.qualified) {
        playerRef.current?.restart();
      }
      // Reset uncredited playback first, then bind the exact identity before
      // resuming so no pre-session viewing can enter the qualification stream.
      sessionBindingRef.current = {
        contextKey,
        sessionId: payload.session.id,
      };
      setWatchSessionState({ contextKey, session: payload.session });
      setWatchSessionUnavailableContext(null);
      if (
        watchSessionUnavailable &&
        activeRef.current &&
        authContextKeyRef.current === contextKey
      ) {
        playerRef.current?.play();
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        authContextKeyRef.current !== contextKey ||
        sessionStartingRef.current !== attempt
      ) {
        return;
      }
      const requestError = unknownRequestError(
        error,
        "Your watch could not be started."
      );
      // Evidence remains public even when qualification infrastructure is
      // unavailable. With no session ID, this playback can never earn credit.
      sessionBindingRef.current = null;
      setWatchSessionState(null);
      setWatchSessionUnavailableContext(contextKey);
      setWatchErrorState({
        contextKey,
        code: requestError.code,
        message: requestError.message,
      });
    } finally {
      if (sessionStartingRef.current === attempt) {
        sessionStartingRef.current = null;
        if (authContextKeyRef.current === contextKey) {
          setPlaybackStartingContext(null);
        }
      }
    }
  }, [
    active,
    authContextKey,
    canTrackWatch,
    playbackGatePending,
    statementId,
    verifiedUserId,
    video,
    videoUrl,
    voteLookupFailed,
    watchSessionUnavailable,
  ]);

  useEffect(() => {
    if (
      !video ||
      !active ||
      !playbackPolicy.needsWatchSession ||
      sessionStartingRef.current
    ) {
      return;
    }
    void startPlayback();
  }, [active, playbackPolicy.needsWatchSession, startPlayback, video]);

  useEffect(() => {
    if (!active || !watchSession?.id || !canTrackWatch) return;

    const interval = window.setInterval(
      () => void enqueueHeartbeat(),
      4_000
    );
    const pauseAndFlush = () => {
      const player = playerRef.current;
      if (!player) return;
      const heartbeat = player.getHeartbeat();
      player.pause();
      void flushHeartbeat({
        ...heartbeat,
        playerState:
          heartbeat.playerState === "ended" ? "ended" : "paused",
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") pauseAndFlush();
    };
    const onPageHide = () => pauseAndFlush();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [
    canTrackWatch,
    active,
    enqueueHeartbeat,
    flushHeartbeat,
    watchSession?.id,
  ]);

  async function submitVote() {
    const contextKey = authContextKey;
    if (
      selectedVote === null ||
      !watchSession?.watchReceiptId ||
      submitting ||
      !verifiedUserId ||
      authContextKeyRef.current !== contextKey
    ) {
      return;
    }
    const controller = new AbortController();
    const attempt: AsyncAttempt = {
      id: ++attemptSequenceRef.current,
      contextKey,
      controller,
    };
    voteSubmitAttemptRef.current = attempt;
    setSubmittingContext(contextKey);
    setWatchErrorState(null);
    try {
      const response = await fetch(`/api/statements/${encodeURIComponent(statementId)}/votes`, {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
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
        throw apiErrorFromPayload(
          payload,
          "Your vote could not be recorded.",
          response.status
        );
      }
      if (
        controller.signal.aborted ||
        authContextKeyRef.current !== contextKey ||
        voteSubmitAttemptRef.current !== attempt
      ) {
        return;
      }
      // A recorded one-time vote no longer needs a qualification channel.
      // Detach it before an older heartbeat response can update this user.
      sessionBindingRef.current = null;
      setWatchSessionState(null);
      setWatchErrorState(null);
      setVoteLookup((previous) =>
        previous?.contextKey === contextKey &&
        previous.userId === verifiedUserId
          ? {
              ...previous,
              ready: true,
              currentVote: {
                voteId: payload.result!.vote.id,
                value: payload.result!.vote.value,
                excluded: false,
                createdAt: payload.result!.vote.createdAt,
              },
            }
          : previous
      );
      setRating(payload.result.rating);
      router.refresh();
    } catch (error) {
      if (
        controller.signal.aborted ||
        authContextKeyRef.current !== contextKey ||
        voteSubmitAttemptRef.current !== attempt
      ) {
        return;
      }
      const requestError = unknownRequestError(
        error,
        "Your vote could not be recorded."
      );
      setWatchErrorState({
        contextKey,
        code: requestError.code,
        message: requestError.message,
      });
    } finally {
      if (voteSubmitAttemptRef.current === attempt) {
        voteSubmitAttemptRef.current = null;
        if (authContextKeyRef.current === contextKey) {
          setSubmittingContext(null);
        }
      }
    }
  }

  const watchProgress = Math.round((watchSession?.qualificationProgress ?? 0) * 100);

  return (
    <section className="ruling-panel" aria-labelledby={`ruling-${statementId}`}>
      <div className="ruling-head">
        <div>
          <span className="lbl">The moment &amp; your ruling</span>
          <strong
            id={`ruling-${statementId}`}
            style={{
              display: "block",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(23px, 3vw, 31px)",
              fontWeight: 400,
              lineHeight: 1.1,
              margin: "5px 0 0",
            }}
          >
            Watch the moment. Judge the whole thing.
          </strong>
        </div>
        <div
          className="ruling-score"
          aria-label={
            !revealPublicResults
              ? "Public result hidden until your vote"
              : hasPublicRulings
              ? `Current public performance ${Math.round(rating.performance)} out of 100`
              : "No public performance yet"
          }
        >
          <span className="num">
            {revealPublicResults && hasPublicRulings
              ? Math.round(rating.performance)
              : "—"}
          </span>
          <small>{revealPublicResults ? "/ 100" : "after vote"}</small>
        </div>
      </div>

      {video ? (
        <VerifiedVideoPlayer
          video={video}
          videoUrl={videoUrl}
          playbackAllowed={playbackAllowed}
          playbackPending={playbackGatePending || playbackStarting}
          active={active}
          onPlaybackRequest={startPlayback}
          onControllerChange={handlePlayerChange}
          onHeartbeat={handlePlayerHeartbeat}
          onError={handlePlayerError}
        />
      ) : (
        <div className="player ruling-player player-locked">
          <span className="lbl">No video is attached</span>
        </div>
      )}

      {playerError && (
        <p className="ruling-alert" role="alert">
          {playerError.message}
        </p>
      )}

      <aside className="judging-guide" aria-label="Five ways to judge the moment">
        <div className="judging-guide-head">
          <span className="lbl">Five judging lenses</span>
          <p>Logic is only one part. Your final vote is how the whole moment lands.</p>
        </div>
        <ul className="judging-lenses">
          {SARCASM_LENSES.map((lens) => (
            <li key={lens.key}>
              <strong>{lens.label}</strong>
              <span>{lens.prompt}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="performance-track" aria-hidden="true">
        <i style={{ width: `${displayedPerformance}%` }} />
        {revealPublicResults && hasPublicRulings && (
          <b style={{ left: `${displayedPerformance}%` }} />
        )}
      </div>
      <div className="performance-legend lbl">
        <span>Flat</span>
        <span>{publicRulingLabel}</span>
        <span>Historic</span>
      </div>
      <div className="ballot-preview" aria-label="Five public vote choices">
        {BALLOT_OPTIONS.map((option) => (
          <span key={option.value}>
            <b>{option.label}</b>
            <small className="num">{option.value}</small>
          </span>
        ))}
      </div>
      <details className="rating-explainer">
        <summary>How the public score works</summary>
        <p>
          Every vote has equal weight. The score is the sum of vote values
          divided by the number of valid votes; GP is 1000 plus ten times that
          score. A clip receives its class and joins the standings after ten
          votes. The five lenses are prompts for your judgement, not five
          separate votes, and none receives a secret multiplier.
          {!revealPublicResults &&
            " The current result stays covered until you enter your own ruling."}
        </p>
      </details>

      <div className="ballot-box">
        {!votingEligible ? (
          <p className="ruling-status">
            This clip is not open for voting yet.
          </p>
        ) : authPending ? (
          <p className="ruling-status">Checking your membership…</p>
        ) : !user ? (
          <p className="ruling-status">
            The video is open to everyone. To vote, <Link href={`/sign-in?callbackURL=${encodeURIComponent(callbackPath)}`}>sign in</Link> or <Link href={`/sign-up?callbackURL=${encodeURIComponent(callbackPath)}`}>register</Link>.
          </p>
        ) : !user.emailVerified ? (
          <p className="ruling-status">
            Verify your email before your watch can count. <Link href="/verify-email">Open verification.</Link>
          </p>
        ) : currentVote ? (
          <div className="ruling-final">
            <span className="stamp green">Vote recorded</span>
            <p>
              You voted <strong>{BALLOT_OPTIONS.find((option) => option.value === currentVote.value)?.label}</strong> ({currentVote.value}/100)
              {currentVote.excluded ? ". This vote is saved but excluded from the public score." : ". One clip, one vote — it cannot be changed."}
            </p>
          </div>
        ) : watchSessionUnavailable ? (
          <div>
            <p className="ruling-status">
              The video remains available, but this viewing cannot count while
              watch qualification is unavailable.
            </p>
            <button
              type="button"
              className="btn ghost"
              disabled={playbackStarting || !active}
              onClick={() =>
                voteLookupFailed
                  ? retryVoteLookup()
                  : void startPlayback()
              }
            >
              {playbackStarting
                ? "Retrying…"
                : voteLookupFailed
                  ? "Retry account check"
                  : "Retry watch"}
            </button>
          </div>
        ) : !watchSession ? (
          <p className="ruling-status">
            {playbackStarting || playbackGatePending
              ? "Getting the clip ready…"
              : "Playback is waiting. Tap the video to retry."}
          </p>
        ) : !qualified ? (
          <div className="watch-progress">
            <div className="watch-progress-copy">
              <span className="lbl">Watch progress</span>
              <span className="num">{watchProgress}%</span>
            </div>
            <div className="watch-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={watchProgress} aria-label="Watch progress">
              <i style={{ width: `${watchProgress}%` }} />
            </div>
            <p>Pausing is fine. Skipped, replayed, background-tab, and seeked time does not add credit.</p>
          </div>
        ) : (
          <div className="ballot-ready">
            <p className="ruling-status"><strong>You have seen it.</strong> Pick how the whole moment lands. This is your one vote on this clip.</p>
            <div className="ballot-options" role="radiogroup" aria-label="Statement performance">
              {BALLOT_OPTIONS.map((option, index) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedVote === option.value}
                  tabIndex={
                    selectedVote === option.value ||
                    (selectedVote === null && index === 0)
                      ? 0
                      : -1
                  }
                  className={selectedVote === option.value ? "selected" : undefined}
                  key={option.value}
                  ref={(element) => {
                    ballotButtonRefs.current[index] = element;
                  }}
                  onClick={() => selectVote(option.value)}
                  onKeyDown={(event) => handleBallotKeyDown(event, index)}
                >
                  <b>{option.label}</b>
                  <span>{option.value}</span>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>
            <button type="button" className="btn seal ballot-submit" disabled={selectedVote === null || submitting} onClick={() => void submitVote()}>
              {submitting ? "Recording vote…" : "Lock in my vote"}
            </button>
          </div>
        )}
        {watchError && (
          <p
            className="ruling-alert"
            role="alert"
            data-error-code={watchError.code ?? undefined}
          >
            {watchError.message}
          </p>
        )}
      </div>

      {revealPublicResults && rating.validVoteCount > 0 && (
        <div className="vote-distribution" aria-label="Public vote distribution">
          {BALLOT_OPTIONS.map((option) => {
            const count = rating.distribution?.[option.value] ?? emptyDistribution()[option.value];
            const width = rating.validVoteCount > 0 ? (count / rating.validVoteCount) * 100 : 0;
            return <i key={option.value} style={{ width: `${width}%` }} title={`${option.label}: ${count}`} />;
          })}
        </div>
      )}

      {revealPublicResults && resultAward && (
        <div className="ruling-award-reveal">
          <ClassAward
            gp={rating.gp}
            validVoteCount={rating.validVoteCount}
            performance={rating.performance}
            rank={resultAward.publicRank}
            hallOfFame={resultAward.hallOfFame}
            variant="hero"
            signatures={sarcasmHighlights(resultAward.axes)}
          />
          <SarcasmProfile
            axes={resultAward.axes}
            compact
            headingLevel={3}
          />
        </div>
      )}
    </section>
  );
}
