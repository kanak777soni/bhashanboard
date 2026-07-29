export const HALL_MIN_VALID_VOTES = 25;
export const HALL_MIN_GP = 1875;

export interface HallEligibility {
  eligible: boolean;
  remainingVotes: number;
  remainingGp: number;
}

export function hallEligibility(statement: {
  gp: number;
  rating: { validVoteCount: number };
}): HallEligibility {
  const validVoteCount = Number.isFinite(statement.rating.validVoteCount)
    ? Math.max(0, Math.trunc(statement.rating.validVoteCount))
    : 0;
  const gp = Number.isFinite(statement.gp) ? Math.round(statement.gp) : 0;
  const remainingVotes = Math.max(0, HALL_MIN_VALID_VOTES - validVoteCount);
  const remainingGp = Math.max(0, HALL_MIN_GP - gp);

  return {
    eligible: remainingVotes === 0 && remainingGp === 0,
    remainingVotes,
    remainingGp,
  };
}

export function isHallEligible(statement: {
  gp: number;
  rating: { validVoteCount: number };
}): boolean {
  return hallEligibility(statement).eligible;
}
