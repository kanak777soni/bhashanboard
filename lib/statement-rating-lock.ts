/**
 * Every operation that can change either a statement's rating inputs or its
 * ballots must serialize on this key. PostgreSQL hashes the returned string
 * with hashtextextended(..., 0) before taking the transaction advisory lock.
 */
export function statementRatingLockKey(statementId: string): string {
  const normalizedId = statementId.trim();
  if (!normalizedId) throw new Error("A statement rating lock needs a statement id.");
  return `bhashan:statement-rating:${normalizedId}`;
}

export class StatementAlreadyVotedError extends Error {
  readonly code = "STATEMENT_ALREADY_VOTED";

  constructor(statementId: string) {
    super(
      `Statement ${statementId} cannot be fully edited after its first vote. ` +
        "Use the dedicated status or Hall of Fame controls instead."
    );
    this.name = "StatementAlreadyVotedError";
  }
}

export function assertStatementHasNoVotes(
  statementId: string,
  hasVotes: unknown
): void {
  if (hasVotes === true || hasVotes === "true") {
    throw new StatementAlreadyVotedError(statementId);
  }
}
