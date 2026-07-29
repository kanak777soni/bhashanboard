"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CloudinaryStatementVideo, StatementVideo } from "@/lib/types";
import {
  assertVideoExcerpt,
  MAX_HOSTED_VIDEO_BYTES,
  MAX_VIDEO_EXCERPT_SECONDS,
  MIN_VIDEO_EXCERPT_SECONDS,
  parseVideoTimestamp,
  parseYouTubeVideo,
} from "@/lib/video";

type VideoMode = "none" | "youtube" | "cloudinary";

interface UploadAuthorization {
  uploadUrl: string;
  uploadToken: string;
  expiresAt: string;
  fields: Record<string, string>;
}

interface PendingUploadCompletion {
  uploadToken: string;
  uploadCompleted: boolean;
}

interface AdminYoutubePlayer {
  cueVideoById(options: {
    videoId: string;
    startSeconds: number;
    endSeconds: number;
  }): void;
  destroy(): void;
  getDuration(): number;
}

interface AdminYoutubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string;
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: { target: AdminYoutubePlayer }) => void;
        onStateChange: (event: {
          data: number;
          target: AdminYoutubePlayer;
        }) => void;
        onError: (event: { data: number }) => void;
      };
    }
  ) => AdminYoutubePlayer;
}

type AdminYoutubeWindow = Window & {
  YT?: AdminYoutubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

type YoutubePreviewState = "idle" | "checking" | "ready" | "error";

const RECOVERABLE_UPLOAD_KEY = "bhashan:cloudinary-upload-completion:v1";
let adminYoutubeApiPromise: Promise<AdminYoutubeApi> | null = null;

const TERMINAL_COMPLETION_CODES = new Set([
  "EXPIRED_UPLOAD_TOKEN",
  "UPLOAD_EXPIRED",
  "INVALID_UPLOAD_TOKEN",
  "VIDEO_UPLOAD_MISMATCH",
  "CLOUDINARY_DERIVATIVE_MISMATCH",
]);

class UploadRequestError extends Error {
  constructor(readonly status: number) {
    super("Cloudinary did not accept the video.");
    this.name = "UploadRequestError";
  }
}

function loadAdminYoutubeApi(): Promise<AdminYoutubeApi> {
  const youtubeWindow = window as AdminYoutubeWindow;
  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT);
  if (adminYoutubeApiPromise) return adminYoutubeApiPromise;

  adminYoutubeApiPromise = new Promise<AdminYoutubeApi>((resolve, reject) => {
    const priorReady = youtubeWindow.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      adminYoutubeApiPromise = null;
      reject(new Error("The YouTube player took too long to load."));
    }, 15_000);

    youtubeWindow.onYouTubeIframeAPIReady = () => {
      priorReady?.();
      window.clearTimeout(timeout);
      if (youtubeWindow.YT?.Player) resolve(youtubeWindow.YT);
      else reject(new Error("The YouTube player could not be initialised."));
    };

    if (
      !document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      )
    ) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        adminYoutubeApiPromise = null;
        reject(new Error("The YouTube player could not be loaded."));
      };
      document.head.appendChild(script);
    }
  });

  return adminYoutubeApiPromise;
}

function youtubePlayerError(code: number): string {
  if (code === 100) {
    return "YouTube says this video is missing or private.";
  }
  if (code === 101 || code === 150) {
    return "The owner has disabled playback on embedded players.";
  }
  if (code === 5) {
    return "YouTube could not play this video in its HTML5 player.";
  }
  return "The YouTube player could not confirm this clip.";
}

function payloadMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function payloadCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.trim() ? code : null;
}

function terminalCompletionFailure(status: number, payload: unknown): boolean {
  if (status === 410) return true;
  return TERMINAL_COMPLETION_CODES.has(payloadCode(payload) ?? "");
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatDuration(durationMs: number): string {
  const seconds = Math.ceil(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

async function browserDuration(file: File): Promise<number | undefined> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<number | undefined>((resolve) => {
      const video = document.createElement("video");
      let settled = false;
      const finish = (value: number | undefined) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute("src");
        video.load();
        resolve(value);
      };
      const timeout = window.setTimeout(() => finish(undefined), 10_000);
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const durationMs = Math.round(video.duration * 1000);
        finish(
          Number.isSafeInteger(durationMs) && durationMs > 0
            ? durationMs
            : undefined
        );
      };
      // Some MOV codecs cannot be decoded by the local browser even though
      // Cloudinary can transcode them. Provider metadata remains authoritative.
      video.onerror = () => finish(undefined);
      video.src = objectUrl;
      video.load();
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function uploadWithProgress(
  authorization: UploadAuthorization,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", authorization.uploadUrl);
    request.timeout = 10 * 60 * 1000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    request.onerror = () => reject(new UploadRequestError(0));
    request.ontimeout = () =>
      reject(new Error("The Cloudinary upload timed out. Select the file and try again."));
    request.onabort = () => reject(new Error("The video upload was cancelled."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new UploadRequestError(request.status));
      }
    };
    const body = new FormData();
    for (const [name, value] of Object.entries(authorization.fields)) {
      body.append(name, value);
    }
    body.append("file", file, file.name);
    request.send(body);
  });
}

export default function CloudinaryVideoUploadField({
  initialVideo,
  configurationIssues,
}: {
  initialVideo?: StatementVideo;
  configurationIssues: string[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const youtubeMountRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<AdminYoutubePlayer | null>(null);
  const uploadsConfigured = configurationIssues.length === 0;
  const [mode, setMode] = useState<VideoMode>(
    initialVideo?.platform ?? (uploadsConfigured ? "cloudinary" : "youtube")
  );
  const [asset, setAsset] = useState<CloudinaryStatementVideo | null>(
    initialVideo?.platform === "cloudinary" ? initialVideo : null
  );
  const [youtubeInput, setYoutubeInput] = useState(
    initialVideo?.platform === "youtube" ? initialVideo.id : ""
  );
  const [youtubeStart, setYoutubeStart] = useState(
    initialVideo?.platform === "youtube" ? String(initialVideo.start) : ""
  );
  const [youtubeEnd, setYoutubeEnd] = useState(
    initialVideo?.platform === "youtube" ? String(initialVideo.end) : ""
  );
  const [youtubePreviewState, setYoutubePreviewState] =
    useState<YoutubePreviewState>("idle");
  const [youtubePreviewMessage, setYoutubePreviewMessage] = useState("");
  const [attachmentToken, setAttachmentToken] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [assetRightsAttested, setAssetRightsAttested] = useState(
    initialVideo?.platform === "cloudinary"
  );
  const [pendingCompletion, setPendingCompletion] =
    useState<PendingUploadCompletion | null>(null);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rightsAttested, setRightsAttested] = useState(false);
  const busy = uploading || completing;
  const cloudinaryReady = Boolean(
    uploadsConfigured &&
      asset &&
      !pendingCompletion?.uploadCompleted &&
      assetRightsAttested
  );

  const youtubePreview = useMemo(() => {
    if (!youtubeInput.trim() && !youtubeStart.trim() && !youtubeEnd.trim()) {
      return { video: undefined, issue: "" };
    }
    const parsed = parseYouTubeVideo(youtubeInput);
    const start = parseVideoTimestamp(youtubeStart);
    const end = parseVideoTimestamp(youtubeEnd);
    if (!parsed) {
      return {
        video: undefined,
        issue: "Enter a valid YouTube URL or 11-character video ID.",
      };
    }
    if (start === undefined || end === undefined) {
      return {
        video: undefined,
        issue: "Enter a valid start and end timestamp.",
      };
    }
    try {
      assertVideoExcerpt({ ...parsed, start, end });
    } catch (previewError) {
      return {
        video: undefined,
        issue:
          previewError instanceof Error
            ? previewError.message
            : "The YouTube excerpt is invalid.",
      };
    }
    return {
      video: { id: parsed.id, start, end },
      issue: "",
    };
  }, [youtubeEnd, youtubeInput, youtubeStart]);

  useEffect(() => {
    try {
      const uploadToken = window.sessionStorage.getItem(RECOVERABLE_UPLOAD_KEY);
      if (uploadToken && uploadToken.length <= 8_192) {
        setPendingCompletion({ uploadToken, uploadCompleted: true });
        setMode("cloudinary");
      }
    } catch {
      // Recovery is optional when browser storage is disabled.
    }
  }, []);

  useEffect(() => {
    youtubePlayerRef.current?.destroy();
    youtubePlayerRef.current = null;

    const preview = youtubePreview.video;
    if (!preview) {
      setYoutubePreviewState("idle");
      setYoutubePreviewMessage("");
      return;
    }

    let disposed = false;
    let readinessTimer: number | null = window.setTimeout(() => {
      if (disposed) return;
      setYoutubePreviewState("error");
      setYoutubePreviewMessage(
        "The player did not confirm this clip. Check the link and timestamps."
      );
    }, 20_000);

    const clearReadinessTimer = () => {
      if (readinessTimer !== null) {
        window.clearTimeout(readinessTimer);
        readinessTimer = null;
      }
    };
    const fail = (message: string) => {
      if (disposed) return;
      clearReadinessTimer();
      setYoutubePreviewState("error");
      setYoutubePreviewMessage(message);
    };

    setYoutubePreviewState("checking");
    setYoutubePreviewMessage("Checking that YouTube can load this exact clip…");

    void loadAdminYoutubeApi()
      .then((api) => {
        if (disposed || !youtubeMountRef.current) return;
        const player = new api.Player(youtubeMountRef.current, {
          host: "https://www.youtube-nocookie.com",
          videoId: preview.id,
          playerVars: {
            controls: 1,
            playsinline: 1,
            rel: 0,
            start: preview.start,
            end: preview.end,
            origin: window.location.origin,
          },
          events: {
            onReady: ({ target }) => {
              if (disposed) return;
              target.cueVideoById({
                videoId: preview.id,
                startSeconds: preview.start,
                endSeconds: preview.end,
              });
            },
            onStateChange: ({ data, target }) => {
              // YouTube state 5 means the requested video is cued and ready.
              if (disposed || data !== 5) return;
              const duration = target.getDuration();
              if (
                !Number.isFinite(duration) ||
                duration <= 0 ||
                preview.start >= duration ||
                preview.end > Math.ceil(duration) + 1
              ) {
                fail("The selected timestamps fall outside this YouTube video.");
                return;
              }
              clearReadinessTimer();
              setYoutubePreviewState("ready");
              setYoutubePreviewMessage(
                "Player ready. You can preview it, but watching is not required."
              );
            },
            onError: ({ data }) => fail(youtubePlayerError(data)),
          },
        });
        youtubePlayerRef.current = player;
      })
      .catch((previewError) => {
        fail(
          previewError instanceof Error
            ? previewError.message
            : "The YouTube player could not be loaded."
        );
      });

    return () => {
      disposed = true;
      clearReadinessTimer();
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [youtubePreview.video]);

  useEffect(() => {
    const form = containerRef.current?.closest("form");
    form?.dispatchEvent(new Event("admin-video-change"));
  }, [
    asset,
    assetRightsAttested,
    cloudinaryReady,
    mode,
    youtubeEnd,
    youtubeInput,
    youtubePreviewState,
    youtubeStart,
  ]);

  useEffect(() => {
    const needsCompletion =
      mode === "cloudinary" && Boolean(pendingCompletion?.uploadCompleted);
    if (!busy && !needsCompletion) return;
    const form = containerRef.current?.closest("form");
    if (!form) return;
    const preventIncompleteSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      setError(
        busy
          ? "Wait for the Cloudinary upload and server checks to finish before saving."
          : "The video is already uploaded. Retry the server checks before saving."
      );
    };
    form.addEventListener("submit", preventIncompleteSubmit);
    return () => form.removeEventListener("submit", preventIncompleteSubmit);
  }, [busy, mode, pendingCompletion]);

  async function completeUpload(uploadToken: string) {
    setError(null);
    setCompleting(true);
    try {
      const completionResponse = await fetch("/api/admin/video-uploads/complete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadToken }),
      });
      const completionPayload = (await completionResponse.json().catch(() => null)) as
        | {
            ok?: boolean;
            result?: {
              video?: CloudinaryStatementVideo;
              attachmentToken?: string;
              playbackUrl?: string;
            };
          }
        | null;
      const completedVideo = completionPayload?.result?.video;
      const completedToken = completionPayload?.result?.attachmentToken;
      const completedPlaybackUrl = completionPayload?.result?.playbackUrl;
      if (
        !completionResponse.ok ||
        completedVideo?.platform !== "cloudinary" ||
        typeof completedToken !== "string" ||
        typeof completedPlaybackUrl !== "string"
      ) {
        const terminal = terminalCompletionFailure(
          completionResponse.status,
          completionPayload
        );
        if (terminal) {
          setPendingCompletion((current) =>
            current?.uploadToken === uploadToken ? null : current
          );
          try {
            window.sessionStorage.removeItem(RECOVERABLE_UPLOAD_KEY);
          } catch {
            // Recovery is optional when browser storage is disabled.
          }
        }
        const message = payloadMessage(
          completionPayload,
          "The uploaded video could not be verified by the server."
        );
        setError(
          terminal
            ? message
            : `${message} The file is already uploaded; retry the server checks without uploading it again.`
        );
        return;
      }

      setPendingCompletion((current) =>
        current?.uploadToken === uploadToken ? null : current
      );
      try {
        window.sessionStorage.removeItem(RECOVERABLE_UPLOAD_KEY);
      } catch {
        // Recovery is optional when browser storage is disabled.
      }
      setAsset(completedVideo);
      setAttachmentToken(completedToken);
      setPlaybackUrl(completedPlaybackUrl);
      setAssetRightsAttested(true);
      setMode("cloudinary");
    } catch {
      setError(
        "The completion request did not reach the server. The file is already uploaded; retry the server checks without uploading it again."
      );
    } finally {
      setCompleting(false);
    }
  }

  async function upload(file: File) {
    setError(null);
    if (!rightsAttested) {
      setError("Confirm that you have permission to host this clip.");
      return;
    }
    // The statement applies to one selected file only. Every replacement must
    // receive a fresh attestation, even if this attempt fails validation.
    setRightsAttested(false);
    const extension = /\.[^.]+$/.exec(file.name.toLowerCase())?.[0] ?? "";
    const expectedType: Record<string, string> = {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
    };
    if (
      !expectedType[extension] ||
      (file.type && file.type.toLowerCase() !== expectedType[extension])
    ) {
      setError("Choose an MP4, MOV or WebM video file.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_HOSTED_VIDEO_BYTES) {
      setError("The video must be 50 MiB or smaller.");
      return;
    }

    let uploadedToken: string | null = null;
    setUploading(true);
    setUploadProgress(0);
    try {
      const durationMs = await browserDuration(file);
      if (
        durationMs !== undefined &&
        (durationMs < MIN_VIDEO_EXCERPT_SECONDS * 1000 ||
          durationMs > MAX_VIDEO_EXCERPT_SECONDS * 1000)
      ) {
        throw new Error("The video must be between three seconds and three minutes long.");
      }

      const authorizationResponse = await fetch("/api/admin/video-uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type.toLowerCase(),
          bytes: file.size,
          rightsAttested: true,
        }),
      });
      const authorizationPayload = (await authorizationResponse.json().catch(() => null)) as
        | { ok?: boolean; upload?: UploadAuthorization }
        | null;
      if (!authorizationResponse.ok || !authorizationPayload?.upload) {
        throw new Error(
          payloadMessage(authorizationPayload, "The upload could not be authorized.")
        );
      }

      const authorization = authorizationPayload.upload;
      setPendingCompletion({
        uploadToken: authorization.uploadToken,
        uploadCompleted: false,
      });
      await uploadWithProgress(authorization, file, setUploadProgress);
      uploadedToken = authorization.uploadToken;
      setPendingCompletion((current) =>
        current?.uploadToken === authorization.uploadToken
          ? { ...current, uploadCompleted: true }
          : current
      );
      try {
        window.sessionStorage.setItem(
          RECOVERABLE_UPLOAD_KEY,
          authorization.uploadToken
        );
      } catch {
        // In-memory recovery remains available for this page.
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof UploadRequestError
          ? uploadError.status === 409
            ? "That Cloudinary video ID already exists. Select the file again."
            : "Cloudinary did not accept or process the video. Check the signed upload preset and try again."
          : uploadError instanceof Error
            ? uploadError.message
            : "The video upload failed."
      );
    } finally {
      setUploading(false);
    }

    if (uploadedToken) {
      await completeUpload(uploadedToken);
    }
  }

  return (
    <div className="admin-video-field" ref={containerRef} aria-busy={busy}>
      <div className="media-source-cards" role="radiogroup" aria-label="Video source">
        <label className={`media-source-card${mode === "cloudinary" ? " selected" : ""}`}>
          <input
            type="radio"
            name="video_platform"
            value="cloudinary"
            checked={mode === "cloudinary"}
            disabled={busy}
            onChange={() => {
              setMode("cloudinary");
              setError(null);
            }}
          />
          <span className="media-source-number">01</span>
          <strong>Upload video file</strong>
          <small>Recommended · MP4, MOV or WebM · up to 50 MiB</small>
          <span className={`media-source-status ${uploadsConfigured ? "ready" : "blocked"}`}>
            {uploadsConfigured ? "Cloudinary configured" : "Setup required"}
          </span>
        </label>

        <label className={`media-source-card${mode === "youtube" ? " selected" : ""}`}>
          <input
            type="radio"
            name="video_platform"
            value="youtube"
            checked={mode === "youtube"}
            disabled={busy}
            onChange={() => {
              setMode("youtube");
              setError(null);
            }}
          />
          <span className="media-source-number">02</span>
          <strong>Paste YouTube link</strong>
          <small>Watch, Shorts, Live, embed and youtu.be links</small>
          <span className="media-source-status ready">No upload required</span>
        </label>

        <div className="media-source-card media-source-card-evidence">
          <span className="media-source-number">03</span>
          <strong>Facebook / Instagram link</strong>
          <small>
            Keep it as an optional reference; social links are not the voting player
          </small>
          <a
            className="media-source-status"
            href="#source-evidence"
            onClick={() => {
              const links = document.getElementById("source-evidence");
              if (links instanceof HTMLDetailsElement) links.open = true;
            }}
          >
            Add under optional links &darr;
          </a>
        </div>

        <label
          className={`media-source-card media-source-card-quiet${mode === "none" ? " selected" : ""}`}
        >
          <input
            type="radio"
            name="video_platform"
            value="none"
            checked={mode === "none"}
            disabled={busy}
            onChange={() => {
              setMode("none");
              setError(null);
            }}
          />
          <span className="media-source-number">04</span>
          <strong>Save without video</strong>
          <small>Keep working as a draft and add the clip later</small>
        </label>
      </div>

      {mode === "youtube" && (
        <div className="youtube-admin-panel">
          <input
            type="hidden"
            name="youtube_preview_ready"
            value={youtubePreviewState === "ready" ? "true" : "false"}
          />
          <div className="admin-grid">
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="lbl">YouTube URL or ID</span>
              <input
                name="video"
                value={youtubeInput}
                onChange={(event) => setYoutubeInput(event.target.value)}
                placeholder="https://youtu.be/... or the bare ID"
              />
            </label>
            <label className="field">
              <span className="lbl">Start</span>
              <input
                name="video_start"
                inputMode="numeric"
                value={youtubeStart}
                onChange={(event) => setYoutubeStart(event.target.value)}
                placeholder="00:41 or 41"
              />
            </label>
            <label className="field">
              <span className="lbl">End</span>
              <input
                name="video_end"
                inputMode="numeric"
                value={youtubeEnd}
                onChange={(event) => setYoutubeEnd(event.target.value)}
                placeholder="01:03 or 63"
              />
            </label>
          </div>

          {youtubePreview.video ? (
            <div className="youtube-admin-preview">
              <div className="youtube-admin-preview-head">
                <span className="lbl">Automatic player check</span>
                <span
                  className={`stamp ${
                    youtubePreviewState === "ready" ? "green" : "foil"
                  }`}
                >
                  {youtubePreviewState === "ready"
                    ? "Player ready"
                    : youtubePreviewState === "error"
                      ? "Check failed"
                      : "Checking"}
                </span>
              </div>
              <div className="youtube-admin-frame">
                <div
                  key={`${youtubePreview.video.id}:${youtubePreview.video.start}:${youtubePreview.video.end}`}
                  ref={youtubeMountRef}
                  aria-label="YouTube clip preview"
                />
              </div>
              <p
                className={
                  youtubePreviewState === "error"
                    ? "ruling-alert"
                    : "rail-note"
                }
                role="status"
              >
                {youtubePreviewMessage}
              </p>
            </div>
          ) : (
            <p className="ruling-alert" role="status">
              {youtubePreview.issue ||
                "Paste a YouTube link and enter start and end timestamps to preview it."}
            </p>
          )}
        </div>
      )}

      {mode === "cloudinary" && (
        <div className="hosted-video-upload-panel">
          <input type="hidden" name="video" value={asset?.id ?? ""} />
          <input
            type="hidden"
            name="video_admin_ready"
            value={cloudinaryReady ? "true" : "false"}
          />
          <input
            type="hidden"
            name="video_rights_attested"
            value={assetRightsAttested ? "true" : "false"}
          />
          <input type="hidden" name="video_attachment_token" value={attachmentToken} />
          <div
            className={`cloudinary-config-status ${
              uploadsConfigured ? "configured" : "missing"
            }`}
            role="status"
          >
            <span className="lbl">
              {uploadsConfigured ? "Cloudinary ready" : "Cloudinary setup incomplete"}
            </span>
            <p>
              {uploadsConfigured
                ? "The server-side keys are present. The dedicated signed preset is checked securely when an upload starts."
                : `Direct upload is unavailable on this deployment. Add ${configurationIssues.join(
                    ", "
                  )} in Vercel Environment Variables, then redeploy. No key value is exposed here.`}
            </p>
          </div>
          {asset ? (
            <div className="hosted-video-uploaded">
              <span className="stamp green">Video ready</span>
              <p>
                H.264/AAC MP4 &middot; {formatDuration(asset.durationMs)}{" "}
                &middot; {formatBytes(asset.derivedBytes)}
              </p>
              <code>{asset.id}</code>
              <div className="hosted-video-asset-actions">
                <button
                  className="linkbtn danger"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAsset(null);
                    setAttachmentToken("");
                    setPlaybackUrl("");
                    setAssetRightsAttested(false);
                    setMode("none");
                    setError(null);
                  }}
                >
                  Remove video
                </button>
              </div>
              {playbackUrl && (
                <div className="hosted-video-playback-approval">
                  <video
                    src={playbackUrl}
                    autoPlay
                    muted
                    controls
                    playsInline
                    preload="metadata"
                  />
                  <p className="rail-note">
                    Optional preview. Watching it through is not required to
                    save or publish.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="rail-note">No hosted video is attached yet.</p>
          )}
          <label className="field hosted-video-rights-attestation">
            <span>
              <input
                type="checkbox"
                checked={rightsAttested}
                disabled={busy}
                onChange={(event) => {
                  setRightsAttested(event.target.checked);
                  setError(null);
                }}
              />{" "}
              I confirm I have permission to host this exact clip.
            </span>
          </label>
          <label
            className={`field hosted-video-file-picker ${
              rightsAttested && uploadsConfigured ? "enabled" : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (busy) return;
              if (!uploadsConfigured) {
                setError("Configure Cloudinary on this deployment before uploading.");
                return;
              }
              if (!rightsAttested) {
                setError("Confirm that you have permission to host this clip.");
                return;
              }
              const file = event.dataTransfer.files?.[0];
              if (file) void upload(file);
            }}
          >
            <span className="lbl">
              {asset ? "Replace with another video" : "Choose a video"}
            </span>
            <strong>
              {rightsAttested
                ? "Select or drop a video file"
                : "Confirm permission above, then select the file"}
            </strong>
            <small>MP4, MOV or WebM · 3 seconds to 3 minutes · maximum 50 MiB</small>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              disabled={busy || !rightsAttested || !uploadsConfigured}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
          {pendingCompletion?.uploadCompleted && (
            <div>
              <span className="stamp foil">
                Cloudinary upload awaiting server checks
              </span>
              <p className="rail-note">
                The authenticated asset is already uploaded. Retrying does not
                upload it again.
              </p>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => void completeUpload(pendingCompletion.uploadToken)}
              >
                Retry server checks
              </button>
            </div>
          )}
          <p className="rail-note">
            {uploading
              ? uploadProgress >= 100
                ? "Upload complete. Cloudinary is generating the browser-ready MP4..."
                : "Uploading directly to authenticated Cloudinary storage..."
              : completing
                ? "Checking Cloudinary metadata and the processed MP4..."
                : "MP4, MOV or WebM; maximum 50 MiB and three minutes. Cloudinary creates the browser-ready H.264/AAC MP4 automatically."}
          </p>
          {uploading && (
            <div
              className="hosted-video-upload-progress"
              role="progressbar"
              aria-label="Cloudinary video upload"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadProgress}
            >
              <i style={{ width: `${uploadProgress}%` }} />
              <span className="lbl">{uploadProgress}% uploaded</span>
            </div>
          )}
        </div>
      )}

      {mode === "none" && (
        <p className="rail-note">
          Save this as a draft now. Add a clip before sending it live.
        </p>
      )}
      {error && <p className="ruling-alert" role="alert">{error}</p>}
    </div>
  );
}
