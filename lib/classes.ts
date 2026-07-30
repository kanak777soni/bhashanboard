import { PUBLIC_CLASS_MIN_VALID_VOTES } from "./rating";
import { provisionalClassFromAxes } from "./sarcasm";
import { tierOf, type Tier } from "./tiers";
import type { Axes } from "./types";

export type StatementClassResolution =
  | {
      source: "public";
      tier: Tier;
      gp: number;
    }
  | {
      source: "provisional";
      tier: Tier;
      gp: number;
      profileTotal: number;
    }
  | {
      source: "pending";
      tier: null;
      gp: null;
    };

/**
 * Public votes always win once the maturity threshold is reached. Before
 * that point, a complete four-factor editorial profile supplies a visibly
 * provisional class; it never enters GP, rank, Standings, or Hall logic.
 */
export function resolveStatementClass({
  gp,
  validVoteCount,
  axes,
}: {
  gp: number;
  validVoteCount: number;
  axes: Axes;
}): StatementClassResolution {
  if (validVoteCount >= PUBLIC_CLASS_MIN_VALID_VOTES) {
    return {
      source: "public",
      tier: tierOf(gp),
      gp,
    };
  }

  const preview = provisionalClassFromAxes(axes);
  if (!preview) {
    return {
      source: "pending",
      tier: null,
      gp: null,
    };
  }

  return {
    source: "provisional",
    tier: preview.tier,
    gp: preview.gp,
    profileTotal: preview.total,
  };
}
