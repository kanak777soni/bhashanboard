import type { StoredStatement } from "@/lib/store";

/**
 * What would be wrong with publishing this entry, stated before you do.
 *
 * These are warnings, not locks — the Committee can place anything it
 * likes. But placing an entry with no Tier A/B source, or one whose
 * wording was never established, is a decision that should be made
 * knowingly rather than by clicking past a form.
 */
export default function PublishGuard({ entry }: { entry: StoredStatement }) {
  const issues: { level: "block" | "warn"; text: string }[] = [];
  const sources = entry.verification.sources ?? [];

  if (!["A", "B"].includes(entry.verification.best_source_tier))
    issues.push({ level: "block", text: "No Tier A or B source. §3.2 says nothing publishes without one." });
  if (sources.length < 2 && entry.verification.best_source_tier !== "A")
    issues.push({ level: "warn", text: "Single-sourced. Corroboration is required below Tier A." });
  if (!entry.quote)
    issues.push({ level: "warn", text: "No verbatim quote established — the page will show a neutral subject line, unquoted." });
  if (!entry.video?.id)
    issues.push({ level: "warn", text: "No clip attached. An entry without video cannot reach the verified stage." });
  if (entry.verification.stage === "text_sourced")
    issues.push({ level: "warn", text: "Verification stage is text-sourced: reported, not verified." });
  if (!entry.counterpoint)
    issues.push({ level: "warn", text: "No counterpoint. An indexed claim with nothing set against it is an accusation, not a record." });

  if (issues.length === 0) {
    return (
      <div className="guard clear">
        <span className="lbl">Ready</span>
        <p>Nothing outstanding. This entry meets the publication bar.</p>
      </div>
    );
  }

  return (
    <div className="guard">
      <span className="lbl">{issues.length} thing{issues.length === 1 ? "" : "s"} outstanding</span>
      <ul>
        {issues.map((i) => (
          <li key={i.text} className={i.level}>
            <span className="guard-pip">{i.level === "block" ? "BLOCK" : "NOTE"}</span>
            {i.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
