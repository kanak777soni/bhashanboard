import { tierOf, tierByKey } from "@/lib/tiers";
import type { TierKey } from "@/lib/types";

export default function Medal({
  gp,
  tier,
  size = 21,
  title = true,
}: {
  gp?: number;
  tier?: TierKey;
  size?: number;
  title?: boolean;
}) {
  const t = tier ? tierByKey(tier) : tierOf(gp ?? 0);
  return (
    <svg
      className="medal"
      style={{ color: t.colour, width: size, height: size }}
      role={title ? "img" : "presentation"}
      aria-label={title ? t.name : undefined}
    >
      {title && <title>{t.name}</title>}
      <use href={`#m-${t.key}`} />
    </svg>
  );
}
