import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { statementReadiness } from "@/lib/readiness";
import { getPoliticians, getStatements } from "@/lib/store";
import { setStatus, toggleHallOfFame } from "../actions";

const READINESS_ORDER: Record<ReturnType<typeof statementReadiness>["key"], number> = {
  private_draft: 0,
  ready: 1,
  production_review: 2,
  needs_video: 3,
  source_review: 4,
  held: 5,
  live: 6,
  withdrawn: 7,
};

const FILTERS: Record<string, { label: string; test: (s: Awaited<ReturnType<typeof getStatements>>[number]) => boolean }> = {
  all: { label: "All", test: () => true },
  private: {
    label: "Private submissions",
    test: (s) => s.status === "private_draft",
  },
  live: { label: "Live", test: (s) => statementReadiness(s).key === "live" },
  ready: { label: "Ready to go live", test: (s) => statementReadiness(s).key === "ready" },
  production: {
    label: "Production review",
    test: (s) => statementReadiness(s).key === "production_review",
  },
  source: {
    label: "Needs video / sourcing",
    test: (s) => ["needs_video", "source_review"].includes(statementReadiness(s).key),
  },
  held: { label: "Held", test: (s) => s.status.startsWith("held") },
  withdrawn: { label: "Withdrawn", test: (s) => s.status === "withdrawn" },
  hof: { label: "Hall of Fame", test: (s) => !!s.hall_of_fame },
  novideo: { label: "No video", test: (s) => !s.video?.id },
  noquote: { label: "No verbatim quote", test: (s) => !s.quote },
  thin: { label: "Single-sourced", test: (s) => (s.verification.sources ?? []).length < 2 },
  tierc: { label: "No Tier A/B", test: (s) => !["A", "B"].includes(s.verification.best_source_tier) },
  unverified: {
    label: "Unverified",
    test: (s) =>
      s.status !== "withdrawn" &&
      s.verification.stage === "text_sourced",
  },
};

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; party?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filterKey = sp.filter && FILTERS[sp.filter] ? sp.filter : "all";
  const q = (sp.q ?? "").toLowerCase();

  const statements = await getStatements();
  const people = new Map((await getPoliticians()).map((p) => [p.id, p]));

  const rows = statements
    .filter(FILTERS[filterKey].test)
    .filter((s) => (sp.party ? s.party_at_time === sp.party : true))
    .filter((s) =>
      q
        ? [s.neutral_title, s.quote ?? "", s.claim, s.venue, people.get(s.speaker_id)?.name ?? "", s.party_at_time]
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true
    )
    .sort((a, b) => {
      const readinessDifference =
        READINESS_ORDER[statementReadiness(a).key] -
        READINESS_ORDER[statementReadiness(b).key];
      if (readinessDifference !== 0) return readinessDifference;
      const dateDifference = (b.date ?? "").localeCompare(a.date ?? "");
      return dateDifference || b.id.localeCompare(a.id);
    });

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Entries</h2>
          <Link className="btn seal" href="/admin/entries/new">
            Add an entry
          </Link>
        </div>

        <form className="admin-filters" action="/admin/entries">
          <label className="field">
            <span className="lbl">Search</span>
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Title, quote, claim, name, venue…" />
          </label>
          <label className="field">
            <span className="lbl">Show</span>
            <select name="filter" defaultValue={filterKey}>
              {Object.entries(FILTERS).map(([k, f]) => (
                <option key={k} value={k}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn ghost" type="submit">
            Apply
          </button>
        </form>

        <p className="lbl" style={{ margin: "12px 0" }}>
          {rows.length} of {statements.length} entries
        </p>
        <p className="rail-note" style={{ margin: "-4px 0 14px" }}>
          This queue is ordered by publication readiness, then date. Internal research axes are
          not a public score; public rank and GP begin only after ten equal-weight rulings.
        </p>

        <div className="tablewrap">
          <table className="ledger admin-table">
            <thead>
              <tr>
                <th>Entry</th>
                <th style={{ width: 130 }}>Representative</th>
                <th style={{ width: 150 }}>Workflow</th>
                <th style={{ width: 150 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    Nothing matches. Rare, but it happens.
                  </td>
                </tr>
              )}
              {rows.map((s) => {
                const p = people.get(s.speaker_id);
                const readiness = statementReadiness(s);
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/entries/${s.id}`} style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>
                        {s.neutral_title}
                      </Link>
                      <div className="entry-sub">
                        {s.id} · {s.category} · internal research notes retained
                        {(s.verification.needs?.length ?? 0) > 0 && (
                          <span className="unquoted">
                            {" "}· {s.verification.needs?.length} outstanding
                          </span>
                        )}
                        {!s.quote && <span className="unquoted"> · no quote</span>}
                        {!s.video?.id && <span className="unquoted"> · no video</span>}
                        {s.hall_of_fame && <span className="tag-new" style={{ marginLeft: 6 }}>HOF</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: 14 }}>
                      {p?.name ?? s.speaker_id}
                      <div className="entry-sub">{s.party_at_time}</div>
                    </td>
                    <td>
                      <span
                        className={`kind ${
                          readiness.key === "withdrawn"
                            ? "withdrawal"
                            : readiness.key === "live"
                              ? "reply"
                              : "correction"
                        }`}
                      >
                        {readiness.label}
                      </span>
                      <div className="entry-sub">
                        {s.status === "published" && readiness.key !== "live"
                          ? "legacy published flag · public gate closed"
                          : s.status.replaceAll("_", " ")}
                      </div>
                    </td>
                    <td>
                      <div className="admin-actions">
                        {readiness.key === "live" ? (
                          <form action={setStatus}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="status" value="held_review" />
                            <button className="linkbtn" type="submit">Hold</button>
                          </form>
                        ) : (
                          <Link className="linkbtn" href={`/admin/entries/${s.id}`}>
                            {readiness.publicationReady
                              ? "Review & publish"
                              : "Complete review"}
                          </Link>
                        )}
                        {(readiness.key === "live" || s.hall_of_fame) && (
                          <form action={toggleHallOfFame}>
                            <input type="hidden" name="id" value={s.id} />
                            <button className="linkbtn" type="submit">
                              {s.hall_of_fame ? "Remove HOF" : "Induct"}
                            </button>
                          </form>
                        )}
                        {s.status !== "withdrawn" && (
                          <form action={setStatus}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="status" value="withdrawn" />
                            <button className="linkbtn danger" type="submit">
                              Withdraw
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
