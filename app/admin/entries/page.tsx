import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { computeLadder, getPoliticians, getStatements, weightedScore } from "@/lib/store";
import { setStatus, toggleHallOfFame } from "../actions";

const FILTERS: Record<string, { label: string; test: (s: Awaited<ReturnType<typeof getStatements>>[number]) => boolean }> = {
  all: { label: "All", test: () => true },
  published: { label: "On the ladder", test: (s) => s.status === "published" },
  held: { label: "Held", test: (s) => s.status.startsWith("held") },
  withdrawn: { label: "Withdrawn", test: (s) => s.status === "withdrawn" },
  hof: { label: "Hall of Fame", test: (s) => !!s.hall_of_fame },
  novideo: { label: "No video", test: (s) => !s.video?.id },
  noquote: { label: "No verbatim quote", test: (s) => !s.quote },
  thin: { label: "Single-sourced", test: (s) => (s.verification.sources ?? []).length < 2 },
  tierc: { label: "No Tier A/B", test: (s) => !["A", "B"].includes(s.verification.best_source_tier) },
  unverified: { label: "Unverified", test: (s) => s.verification.stage === "text_sourced" },
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
  const ladder = new Map(computeLadder(statements).map((l) => [l.id, l]));

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
    .sort((a, b) => (ladder.get(a.id)?.rank ?? 9999) - (ladder.get(b.id)?.rank ?? 9999));

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

        <div className="tablewrap">
          <table className="ledger admin-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 58 }}>GP</th>
                <th>Entry</th>
                <th style={{ width: 130 }}>Representative</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 150 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Nothing matches. Rare, but it happens.
                  </td>
                </tr>
              )}
              {rows.map((s) => {
                const l = ladder.get(s.id);
                const p = people.get(s.speaker_id);
                return (
                  <tr key={s.id}>
                    <td className="num">{l?.rank ?? "—"}</td>
                    <td className="num">{l?.gp ?? "—"}</td>
                    <td>
                      <Link href={`/admin/entries/${s.id}`} style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>
                        {s.neutral_title}
                      </Link>
                      <div className="entry-sub">
                        {s.id} · {s.category} · score {weightedScore(s.axes).toFixed(2)}
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
                      <span className={`kind ${s.status === "withdrawn" ? "withdrawal" : s.status === "published" ? "reply" : "correction"}`}>
                        {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <form action={setStatus}>
                          <input type="hidden" name="id" value={s.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={s.status === "published" ? "held_review" : "published"}
                          />
                          <button className="linkbtn" type="submit">
                            {s.status === "published" ? "Hold" : "Place"}
                          </button>
                        </form>
                        <form action={toggleHallOfFame}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="linkbtn" type="submit">
                            {s.hall_of_fame ? "Remove HOF" : "Induct"}
                          </button>
                        </form>
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
