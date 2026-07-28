"use client";

import { useEffect, useRef, useState } from "react";
import type { R2StatementVideo, StatementVideo } from "@/lib/types";
import { MAX_R2_VIDEO_BYTES, MAX_VIDEO_EXCERPT_SECONDS, MIN_VIDEO_EXCERPT_SECONDS } from "@/lib/video";

type VideoMode = "none" | "youtube" | "r2";

interface UploadAuthorization {
  key: string;
  uploadUrl: string;
  uploadToken: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

interface PendingUploadCompletion {
  uploadToken: string;
  putCompleted: boolean;
}

const TERMINAL_COMPLETION_CODES = new Set([
  "EXPIRED_UPLOAD_TOKEN",
  "UPLOAD_EXPIRED",
  "INVALID_UPLOAD_TOKEN",
  "INVALID_MP4",
  "VIDEO_UPLOAD_MISMATCH",
  "R2_FINAL_CONFLICT",
]);

class UploadRequestError extends Error {
  constructor(readonly status: number) {
    super("Cloudflare R2 did not accept the video.");
    this.name = "UploadRequestError";
  }
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

function playedEntireVideo(video: HTMLVideoElement): boolean {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return false;
  const toleranceSeconds = 0.35;
  let coveredThrough = 0;
  for (let index = 0; index < video.played.length; index += 1) {
    const start = video.played.start(index);
    const end = video.played.end(index);
    if (start > coveredThrough + toleranceSeconds) return false;
    coveredThrough = Math.max(coveredThrough, end);
  }
  return coveredThrough >= video.duration - toleranceSeconds;
}

async function browserDuration(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const durationMs = Math.round(video.duration * 1000);
        if (!Number.isSafeInteger(durationMs) || durationMs <= 0) {
          reject(new Error("The browser could not read this video's duration."));
        } else {
          resolve(durationMs);
        }
      };
      video.onerror = () => reject(new Error("This browser cannot read the selected MP4."));
      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function putWithProgress(
  authorization: UploadAuthorization,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", authorization.uploadUrl);
    for (const [name, value] of Object.entries(authorization.requiredHeaders)) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    request.onerror = () => reject(new UploadRequestError(0));
    request.onabort = () => reject(new Error("The video upload was cancelled."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new UploadRequestError(request.status));
      }
    };
    request.send(file);
  });
}

export default function R2VideoUploadField({ initialVideo }: { initialVideo?: StatementVideo }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<VideoMode>(initialVideo?.platform ?? "youtube");
  const [asset, setAsset] = useState<R2StatementVideo | null>(
    initialVideo?.platform === "r2" ? initialVideo : null
  );
  const [attachmentToken, setAttachmentToken] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [previewReachedEnd, setPreviewReachedEnd] = useState(false);
  const [playbackAttested, setPlaybackAttested] = useState(false);
  const [pendingCompletion, setPendingCompletion] =
    useState<PendingUploadCompletion | null>(null);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rightsAttested, setRightsAttested] = useState(false);
  const busy = uploading || completing;

  useEffect(() => {
    const needsCompletion =
      mode === "r2" && Boolean(pendingCompletion?.putCompleted);
    const needsPlaybackApproval =
      mode === "r2" && Boolean(attachmentToken) && !playbackAttested;
    if (!busy && !needsCompletion && !needsPlaybackApproval) return;
    const form = containerRef.current?.closest("form");
    if (!form) return;
    const preventIncompleteSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      setError(
        busy
          ? "Wait for the R2 upload and server checks to finish before saving."
          : needsCompletion
            ? "The MP4 is already uploaded. Retry the server checks before saving."
            : "Play the uploaded clip through to the end, then confirm playback before saving."
      );
    };
    form.addEventListener("submit", preventIncompleteSubmit);
    return () => form.removeEventListener("submit", preventIncompleteSubmit);
  }, [attachmentToken, busy, mode, pendingCompletion, playbackAttested]);

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
              video?: R2StatementVideo;
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
        completedVideo?.platform !== "r2" ||
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
        }
        const message = payloadMessage(
          completionPayload,
          "The uploaded MP4 could not be verified by the server."
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
      setAsset(completedVideo);
      setAttachmentToken(completedToken);
      setPlaybackUrl(completedPlaybackUrl);
      setPreviewReachedEnd(false);
      setPlaybackAttested(false);
      setMode("r2");
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
      setError("Confirm the rights and provenance attestation before uploading.");
      return;
    }
    if ((file.type && file.type !== "video/mp4") || !/\.mp4$/i.test(file.name)) {
      setError("Choose an MP4 file. MOV, MKV, AVI and HEVC-only files are not accepted.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_R2_VIDEO_BYTES) {
      setError("The video must be 50 MiB or smaller.");
      return;
    }

    let uploadedToken: string | null = null;
    setUploading(true);
    setUploadProgress(0);
    try {
      const durationMs = await browserDuration(file);
      if (
        durationMs < MIN_VIDEO_EXCERPT_SECONDS * 1000 ||
        durationMs > MAX_VIDEO_EXCERPT_SECONDS * 1000
      ) {
        throw new Error("The video must be between three seconds and three minutes long.");
      }

      const authorizationResponse = await fetch("/api/admin/video-uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: "video/mp4",
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
        putCompleted: false,
      });
      await putWithProgress(authorization, file, setUploadProgress);
      uploadedToken = authorization.uploadToken;
      setPendingCompletion((current) =>
        current?.uploadToken === authorization.uploadToken
          ? { ...current, putCompleted: true }
          : current
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof UploadRequestError
          ? uploadError.status === 412
            ? "That immutable video key already exists. Select the file again."
            : "Cloudflare R2 did not accept the video. Check the bucket CORS settings."
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
      <label className="field">
        <span className="lbl">Video source</span>
        <select
          name="video_platform"
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as VideoMode);
            setError(null);
          }}
        >
          <option value="youtube">YouTube excerpt</option>
          <option value="r2">Upload an MP4 to Cloudflare R2</option>
          <option value="none">No video</option>
        </select>
      </label>

      {mode === "youtube" && (
        <div className="admin-grid">
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="lbl">YouTube URL or ID</span>
            <input
              name="video"
              defaultValue={initialVideo?.platform === "youtube" ? initialVideo.id : ""}
              placeholder="https://youtu.be/… or the bare id"
            />
          </label>
          <label className="field">
            <span className="lbl">Start</span>
            <input
              name="video_start"
              inputMode="numeric"
              defaultValue={initialVideo?.platform === "youtube" ? initialVideo.start : ""}
              placeholder="00:41 or 41"
            />
          </label>
          <label className="field">
            <span className="lbl">End</span>
            <input
              name="video_end"
              inputMode="numeric"
              defaultValue={initialVideo?.platform === "youtube" ? initialVideo.end : ""}
              placeholder="01:03 or 63"
            />
          </label>
        </div>
      )}

      {mode === "r2" && (
        <div className="r2-upload-panel">
          <input type="hidden" name="video" value={asset?.id ?? ""} />
          <input type="hidden" name="video_attachment_token" value={attachmentToken} />
          <input
            type="hidden"
            name="video_playback_attested"
            value={attachmentToken && playbackAttested ? "true" : "false"}
          />
          {asset ? (
            <div className="r2-uploaded">
              <span className="stamp green">
                {playbackAttested || !attachmentToken
                  ? "R2 video playback approved"
                  : "R2 container structure accepted"}
              </span>
              <p>
                MP4 · structurally declares H.264/AAC · {formatDuration(asset.durationMs)} · {formatBytes(asset.bytes)}
              </p>
              <code>{asset.id}</code>
              {playbackUrl && (
                <div className="r2-playback-approval">
                  <video
                    src={playbackUrl}
                    controls
                    playsInline
                    preload="metadata"
                    onEnded={(event) => {
                      const complete = playedEntireVideo(event.currentTarget);
                      setPreviewReachedEnd(complete);
                      setPlaybackAttested(false);
                      setError(
                        complete
                          ? null
                          : "Playback skipped part of the promoted clip. Replay it from the beginning without seeking."
                      );
                    }}
                    onError={() => {
                      setPreviewReachedEnd(false);
                      setPlaybackAttested(false);
                      setError(
                        "This promoted MP4 did not play correctly in the browser. Do not attach it."
                      );
                    }}
                  />
                  <label className="field r2-playback-attestation">
                    <span>
                      <input
                        type="checkbox"
                        checked={playbackAttested}
                        disabled={!previewReachedEnd}
                        onChange={(event) => {
                          setPlaybackAttested(event.target.checked);
                          setError(null);
                        }}
                      />{" "}
                      I played this promoted clip through to the end and confirm that its picture
                      and audio work in the browser.
                    </span>
                  </label>
                  {!previewReachedEnd && (
                    <p className="rail-note">
                      Full playback is required once before this new upload can be attached.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="rail-note">No hosted video is attached yet.</p>
          )}
          <label className="field r2-rights-attestation">
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
              I confirm that this exact footage is rights-cleared for hosting and that its
              publisher/source provenance is recorded in this entry.
            </span>
          </label>
          <label className="field r2-file-picker">
            <span className="lbl">{asset ? "Replace with another MP4" : "Choose an MP4"}</span>
            <input
              type="file"
              accept="video/mp4,.mp4"
              disabled={busy || !rightsAttested}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
          {pendingCompletion?.putCompleted && (
            <div>
              <span className="stamp foil">R2 upload awaiting server checks</span>
              <p className="rail-note">
                The MP4 is already in private quarantine. Retrying does not upload it again.
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
              ? "Uploading to private quarantine..."
              : completing
                ? "Checking and promoting the uploaded file..."
                : "Maximum 50 MiB and three minutes. The server accepts only a fast-start MP4 structure declaring H.264 video and AAC audio; full browser playback approval is still required."}
          </p>
          {uploading && (
            <div
              className="r2-upload-progress"
              role="progressbar"
              aria-label="R2 video upload"
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
        <p className="rail-note">The entry cannot become committee-passed or accept votes without a video.</p>
      )}
      {error && <p className="ruling-alert" role="alert">{error}</p>}
    </div>
  );
}
