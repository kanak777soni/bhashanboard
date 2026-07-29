import type { StoredStatement } from "@/lib/store";
import { committeePublicationIssues } from "@/lib/video";

/**
 * What would be wrong with publishing this entry, stated before you do.
 *
 * Blocking issues are the same fail-closed rules enforced by the admin
 * mutation and vote gate. Notes are editorial improvements that do not
 * decide voting eligibility.
 */
export default function PublishGuard({ entry }: { entry: StoredStatement }) {
  const issues: { level: "block" | "warn"; text: string }[] =
    committeePublicationIssues({ ...entry, status: "published" }).map((text) => ({
      level: "block",
      text,
    }));
  const sources = entry.verification.sources ?? [];

  if (sources.length < 2 && entry.verification.best_source_tier !== "A")
    issues.push({ level: "warn", text: "Single-sourced. Corroboration is required below Tier A." });
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
