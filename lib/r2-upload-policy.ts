export type ExpirableR2UploadStatus = "authorized" | "processing";

/**
 * The browser PUT window is deliberately short, but once a completion request
 * owns the processing lease only the longer intent lifetime may expire it.
 * Keeping this decision pure makes the 30-minute boundary regression-testable.
 */
export function r2UploadIntentShouldExpire({
  status,
  uploadExpiresAtMs,
  intentExpiresAtMs,
  nowMs,
}: {
  status: ExpirableR2UploadStatus;
  uploadExpiresAtMs: number;
  intentExpiresAtMs: number;
  nowMs: number;
}): boolean {
  if (![uploadExpiresAtMs, intentExpiresAtMs, nowMs].every(Number.isFinite)) return true;
  return status === "authorized"
    ? uploadExpiresAtMs <= nowMs || intentExpiresAtMs <= nowMs
    : intentExpiresAtMs <= nowMs;
}
