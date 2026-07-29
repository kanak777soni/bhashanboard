import {
  committeePublicationIssues,
  normalizeStatementEvidenceVideo,
  normalizeVerificationStage,
} from "./video";

export type StatementReadinessKey =
  | "source_review"
  | "needs_video"
  | "production_review"
  | "ready"
  | "live"
  | "held"
  | "withdrawn";

export interface ReadinessStatement {
  status?: unknown;
  quote?: unknown;
  language?: unknown;
  quote_translation?: unknown;
  context?: unknown;
  video?: unknown;
  verification?: {
    stage?: unknown;
    best_source_tier?: unknown;
    sources?: unknown;
  } | null;
}

export interface StatementReadiness {
  key: StatementReadinessKey;
  label: string;
  blockers: string[];
  publicationReady: boolean;
}

const READINESS_LABELS: Record<StatementReadinessKey, string> = {
  source_review: "Quote & source review",
  needs_video: "Needs video",
  production_review: "Transcript, context & sign-off",
  ready: "Ready to publish",
  live: "Live · ready to rule",
  held: "Held for review",
  withdrawn: "Withdrawn",
};

/**
 * One presentation-layer readiness model for the public record and the admin
 * production queue. The persisted `status` field is historical placement
 * state; a record is live only when the complete publication rule also passes.
 */
export function statementReadiness(
  statement: ReadinessStatement
): StatementReadiness {
  const status =
    typeof statement.status === "string" ? statement.status : "held_review";
  const publicationCandidate = { ...statement, status: "published" };
  const blockers = committeePublicationIssues(publicationCandidate);
  const publicationReady = blockers.length === 0;

  let key: StatementReadinessKey;
  if (status === "withdrawn") {
    key = "withdrawn";
  } else if (publicationReady && status === "published") {
    key = "live";
  } else if (publicationReady) {
    key = "ready";
  } else if (!normalizeStatementEvidenceVideo(statement)) {
    key = "needs_video";
  } else if (
    normalizeVerificationStage(statement.verification?.stage) !==
    "committee_passed"
  ) {
    key = "production_review";
  } else if (status === "held_review" || status === "held_parity") {
    key = "held";
  } else {
    key = "source_review";
  }

  return {
    key,
    label: READINESS_LABELS[key],
    blockers,
    publicationReady,
  };
}

export function readinessLabel(key: StatementReadinessKey): string {
  return READINESS_LABELS[key];
}
