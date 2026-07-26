/**
 * Pairwise Elo — docs/02-ranking-system.md §2.2.
 *
 * Ratings are never mutated in place in production; they are recomputed
 * nightly from an immutable vote log so a fraud sweep can retroactively
 * unwind a brigade. These helpers are the pure per-duel maths that the
 * recompute walks over.
 */

export const START_RATING = 1500;
export const PLACEMENT_DUELS = 20;

/** Probability that A is judged more magnificent than B. */
export function expected(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** K falls as an entry accumulates duels, so classics stop thrashing. */
export function kFactor(duels: number): number {
  if (duels < PLACEMENT_DUELS) return 40;
  if (duels < 500) return 20;
  return 10;
}

export interface DuelOutcome {
  winner: number;
  loser: number;
}

/**
 * @param weight Voter weight. Committee raters sit at 1; public ballots are
 *   weighted by account history and are discounted to 0 when a coordinated
 *   cohort is detected (§2.6).
 */
export function applyDuel(
  winnerRating: number,
  winnerDuels: number,
  loserRating: number,
  loserDuels: number,
  weight = 1
): DuelOutcome {
  const expWinner = expected(winnerRating, loserRating);
  const kW = kFactor(winnerDuels) * weight;
  const kL = kFactor(loserDuels) * weight;
  return {
    winner: winnerRating + kW * (1 - expWinner),
    loser: loserRating + kL * (0 - (1 - expWinner)),
  };
}

/** Displayed rating is pulled toward the mean until an entry has enough duels. */
export function shrunk(rating: number, duels: number): number {
  if (duels >= PLACEMENT_DUELS) return rating;
  const confidence = duels / PLACEMENT_DUELS;
  return START_RATING + (rating - START_RATING) * confidence;
}
