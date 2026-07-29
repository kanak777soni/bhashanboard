import {
  calculateRating,
  PUBLIC_EMPTY_PERFORMANCE,
  RATING_PRIOR_STRENGTH,
} from "./rating";
import type {
  PersistedStatementRatingAggregate,
  VoteDistribution,
} from "./types";

const LEGACY_RATING_MODEL_VERSION = 1;
const LEGACY_RATING_PRIOR_STRENGTH = 10;

/**
 * Database-shaped aggregate input. `performance` and `gp` are deliberately
 * accepted but never trusted: both are derived again from valid ballot totals.
 */
export interface RatingAggregateRecord {
  statement_id: unknown;
  prior_performance: unknown;
  prior_strength: unknown;
  valid_vote_count: unknown;
  valid_vote_sum: unknown;
  vote_0_count: unknown;
  vote_25_count: unknown;
  vote_50_count: unknown;
  vote_75_count: unknown;
  vote_100_count: unknown;
  performance?: unknown;
  gp?: unknown;
  model_version: unknown;
  updated_at: unknown;
}

function finiteNumber(value: unknown, field: string): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(`Rating aggregate has invalid ${field}.`);
  }
  return parsed;
}

function safeInteger(value: unknown, field: string): number {
  const parsed = finiteNumber(value, field);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Rating aggregate has invalid ${field}.`);
  }
  return parsed;
}

export function parseRatingAggregate(
  row: RatingAggregateRecord
): PersistedStatementRatingAggregate {
  const statementId = String(row.statement_id ?? "");
  if (!/^IN-[0-9]{4,}$/.test(statementId)) {
    throw new Error("Rating aggregate has an invalid statement id.");
  }

  const priorPerformance = finiteNumber(
    row.prior_performance,
    "prior performance"
  );
  const priorStrength = safeInteger(row.prior_strength, "prior strength");
  const storedModelVersion = safeInteger(row.model_version, "model version");
  const isCurrentModel = storedModelVersion === 2;
  const isLegacyModel =
    storedModelVersion === LEGACY_RATING_MODEL_VERSION &&
    priorStrength === LEGACY_RATING_PRIOR_STRENGTH &&
    priorPerformance >= 0 &&
    priorPerformance <= 100;
  if (!isCurrentModel && !isLegacyModel) {
    throw new Error(
      `Rating aggregate ${statementId} uses unsupported model configuration.`
    );
  }
  if (
    isCurrentModel &&
    (priorPerformance !== PUBLIC_EMPTY_PERFORMANCE ||
      priorStrength !== RATING_PRIOR_STRENGTH)
  ) {
    throw new Error(
      `Rating aggregate ${statementId} uses an invalid model-v2 baseline.`
    );
  }
  const validVoteCount = safeInteger(
    row.valid_vote_count,
    "valid vote count"
  );
  const validVoteSum = safeInteger(row.valid_vote_sum, "valid vote sum");
  const distribution: VoteDistribution = {
    0: safeInteger(row.vote_0_count, "zero-vote count"),
    25: safeInteger(row.vote_25_count, "25-vote count"),
    50: safeInteger(row.vote_50_count, "50-vote count"),
    75: safeInteger(row.vote_75_count, "75-vote count"),
    100: safeInteger(row.vote_100_count, "100-vote count"),
  };
  const distributionTotal = Object.values(distribution).reduce(
    (sum, count) => sum + count,
    0
  );
  const distributionSum =
    distribution[25] * 25 +
    distribution[50] * 50 +
    distribution[75] * 75 +
    distribution[100] * 100;
  if (
    distributionTotal !== validVoteCount ||
    distributionSum !== validVoteSum
  ) {
    throw new Error(
      `Rating aggregate ${statementId} has inconsistent vote totals.`
    );
  }

  const calculated = calculateRating({
    validVoteCount,
    validVoteSum,
  });
  const updatedAt =
    row.updated_at instanceof Date
      ? row.updated_at
      : new Date(String(row.updated_at));
  if (Number.isNaN(updatedAt.getTime())) {
    throw new Error(
      `Rating aggregate ${statementId} has an invalid update time.`
    );
  }

  return {
    statementId,
    // During a rolling deployment, an old application instance may still
    // return a model-v1 row. Its cached editorial prior is deliberately
    // discarded; only its internally consistent ballot totals are projected
    // into the public model-v2 result.
    priorPerformance: calculated.priorPerformance,
    priorStrength: calculated.priorStrength,
    validVoteCount,
    validVoteSum,
    distribution,
    performance: calculated.performance,
    gp: calculated.gp,
    modelVersion: calculated.modelVersion,
    updatedAt: updatedAt.toISOString(),
  };
}
