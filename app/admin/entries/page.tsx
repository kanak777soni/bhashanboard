import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { statementReadiness } from "@/lib/readiness";
import {
  getPoliticians,
  getStatements,
  getStatementVoteCounts,
} from "@/lib/store";
import { setStatus, toggleHallOfFame } from "../actions";

const READINESS_ORDER: Record<
  ReturnType<typeof statementReadiness>["key"],
  number
> = {
  private_draft: 0,
  ready: 1,
  production_review: 2,
  needs_video: 3,
  source_review: 4,
  held: 5,
  live: 6,
  withdrawn: 7,
};

type Statement = Awaited<ReturnType<typeof getStatements>>[number];

const FILTERS: Record<
  string,
  { label: string; test: (statement: Statement) => boolean }
> = {
  all: { label: "All", test: () => true },
  private: {
    label: "Reader drafts",
    test: (statement) => statement.status === "private_draft",
  },
  live: {
    label: "Live",
    test: (statement) => statementReadiness(statement).key === "live",
  },
  ready: {
    label: "Ready to go live",
    test: (statement) => statementReadiness(statement).key === "ready",
  },
  production: {
    label: "Needs card details",
    test: (statement) =>
      statementReadiness(statement).key === "production_review",
  },
  source: {
    label: "Needs a clip",
    test: (statement) =>
      ["needs_video", "source_review"].includes(
        statementReadiness(statement).key
      ),
  },
  held: {
    label: "Other drafts",
    test: (statement) => statement.status.startsWith("held"),
  },
  withdrawn: {
    label: "Withdrawn",
    test: (statement) => statement.status === "withdrawn",
  },
  hof: {
    label: "Hall of Fame",
    test: (statement) => Boolean(statement.hall_of_fame),
  },
  novideo: {
    label: "Needs clip",
    test: (statement) => !statement.video?.id,
  },
  noquote: {
    label: "Needs quote",
    test: (statement) => !statement.quote,
  },
};

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; party?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const filterKey =
    params.filter && FILTERS[params.filter] ? params.filter : "all";
  const query = (params.q ?? "").toLowerCase();

  const [statements, politicians, voteCounts] = await Promise.all([
    getStatements(),
    getPoliticians(),
    getStatementVoteCounts(),
  ]);
  const people = new Map(
    politicians.map((person) => [person.id, person])
  );

  const rows = statements
    .filter(FILTERS[filterKey].test)
    .filter((statement) =>
      params.party ? statement.party_at_time === params.party : true
    )
    .filter((statement) =>
      query
        ? [
            statement.neutral_title,
            statement.quote ?? "",
            statement.claim,
            statement.venue,
            people.get(statement.speaker_id)?.name ?? "",
            statement.party_at_time,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
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
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Title, quote, setup, name, venue…"
          />
        </label>
        <label className="field">
          <span className="lbl">Show</span>
          <select name="filter" defaultValue={filterKey}>
            {Object.entries(FILTERS).map(([key, filter]) => (
              <option key={key} value={key}>
                {filter.label}
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
        Draft &rarr; Preview &rarr; Live. Entries with a finished card and clip
        rise to the top; GP and rank begin after ten user votes.
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
            {rows.map((statement) => {
              const person = people.get(statement.speaker_id);
              const readiness = statementReadiness(statement);
              const voteCount = voteCounts.get(statement.id) ?? 0;
              return (
                <tr key={statement.id}>
                  <td>
                    <Link
                      href={`/admin/entries/${statement.id}`}
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 16,
                      }}
                    >
                      {statement.neutral_title}
                    </Link>
                    <div className="entry-sub">
                      {statement.id} · {statement.category}
                      {!statement.quote && (
                        <span className="unquoted"> · no quote</span>
                      )}
                      {!statement.video?.id && (
                        <span className="unquoted"> · no clip</span>
                      )}
                      {voteCount > 0 && (
                        <span>
                          {" "}· {voteCount} vote{voteCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {statement.hall_of_fame && (
                        <span className="tag-new" style={{ marginLeft: 6 }}>
                          HOF
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: 14 }}>
                    {person?.name ?? statement.speaker_id}
                    <div className="entry-sub">
                      {statement.party_at_time}
                    </div>
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
                      {statement.status === "published" &&
                      readiness.key !== "live"
                        ? "saved as published · currently offline"
                        : statement.status.replaceAll("_", " ")}
                    </div>
                  </td>
                  <td>
                    <div className="admin-actions">
                      {readiness.key === "live" ? (
                        <form action={setStatus}>
                          <input
                            type="hidden"
                            name="id"
                            value={statement.id}
                          />
                          <input
                            type="hidden"
                            name="status"
                            value="held_review"
                          />
                          <button className="linkbtn" type="submit">
                            Take offline
                          </button>
                        </form>
                      ) : readiness.publicationReady &&
                        voteCount > 0 &&
                        statement.status.startsWith("held") ? (
                        <Link
                          className="linkbtn"
                          href={`/admin/entries/${statement.id}`}
                        >
                          Preview &amp; put back live
                        </Link>
                      ) : (
                        <Link
                          className="linkbtn"
                          href={`/admin/entries/${statement.id}`}
                        >
                          {readiness.publicationReady
                            ? "Preview & go live"
                            : "Finish draft"}
                        </Link>
                      )}
                      {(readiness.key === "live" ||
                        statement.hall_of_fame) && (
                        <form action={toggleHallOfFame}>
                          <input
                            type="hidden"
                            name="id"
                            value={statement.id}
                          />
                          <button className="linkbtn" type="submit">
                            {statement.hall_of_fame
                              ? "Remove HOF"
                              : "Add to HOF"}
                          </button>
                        </form>
                      )}
                      {statement.status !== "withdrawn" && (
                        <form action={setStatus}>
                          <input
                            type="hidden"
                            name="id"
                            value={statement.id}
                          />
                          <input
                            type="hidden"
                            name="status"
                            value="withdrawn"
                          />
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
  );
}
