import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { statementReadiness } from "@/lib/readiness";
import { getStatements } from "@/lib/store";

export default async function AdminOverview() {
  await requireAdmin();
  const statements = await getStatements();
  const inventory = statements.map((statement) => ({
    statement,
    readiness: statementReadiness(statement),
  }));
  const readinessCounts = inventory.reduce<Record<string, number>>(
    (counts, item) => {
      counts[item.readiness.key] = (counts[item.readiness.key] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const privateDrafts = statements.filter(
    (statement) => statement.status === "private_draft"
  );
  const activeEntries = statements.filter(
    (statement) =>
      statement.status !== "withdrawn" &&
      statement.status !== "private_draft"
  );
  const partyCounts = activeEntries.reduce<Map<string, number>>(
    (counts, statement) => {
      counts.set(
        statement.party_at_time,
        (counts.get(statement.party_at_time) ?? 0) + 1
      );
      return counts;
    },
    new Map()
  );
  const coverage = [...partyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([party, count]) => ({
      party,
      count,
      pct: Math.round((count / Math.max(activeEntries.length, 1)) * 100),
    }));

  const noQuote = activeEntries.filter((statement) => !statement.quote).length;
  const noVideo = activeEntries.filter((statement) => !statement.video?.id).length;

  return (
    <>
      <section className="admin-cards">
        <div className="admin-card">
          <span className="lbl">All entries</span>
          <b className="num">{statements.length}</b>
        </div>
        <div className="admin-card">
          <span className="lbl">Live</span>
          <b className="num">{readinessCounts.live ?? 0}</b>
        </div>
        <div className="admin-card">
          <span className="lbl">Ready</span>
          <b className="num">{readinessCounts.ready ?? 0}</b>
        </div>
        <div className="admin-card">
          <span className="lbl">Reader drafts</span>
          <b className="num">{privateDrafts.length}</b>
        </div>
        <div className="admin-card">
          <span className="lbl">Drafts to finish</span>
          <b className="num">
            {(readinessCounts.production_review ?? 0) +
              (readinessCounts.needs_video ?? 0)}
          </b>
        </div>
        <div className="admin-card">
          <span className="lbl">Withdrawn</span>
          <b className="num">{readinessCounts.withdrawn ?? 0}</b>
        </div>
      </section>

      <section className="admin-section">
        <h2>Draft &rarr; Preview &rarr; Live</h2>
        <p className="rail-note" style={{ marginBottom: 12 }}>
          Add the clip, finish the card essentials, check the preview, then
          choose Go live. Links and private notes stay optional.
        </p>
        <table className="ledger">
          <tbody>
            <tr>
              <td className="num">{privateDrafts.length}</td>
              <td>
                reader suggestions are waiting as <strong>private drafts</strong>
              </td>
              <td>
                <Link href="/admin/entries?filter=private">Open drafts</Link>
              </td>
            </tr>
            <tr>
              <td className="num">{readinessCounts.ready ?? 0}</td>
              <td>
                entries have a finished card and clip and are{" "}
                <strong>ready to go live</strong>
              </td>
              <td>
                <Link href="/admin/entries?filter=ready">
                  Preview and publish
                </Link>
              </td>
            </tr>
            <tr>
              <td className="num">
                {readinessCounts.production_review ?? 0}
              </td>
              <td>
                drafts have a clip but still need{" "}
                <strong>card essentials</strong>
              </td>
              <td>
                <Link href="/admin/entries?filter=production">
                  Finish cards
                </Link>
              </td>
            </tr>
            <tr>
              <td className="num">{noVideo}</td>
              <td>
                drafts have <strong>no clip attached</strong>
              </td>
              <td>
                <Link href="/admin/entries?filter=novideo">Add clips</Link>
              </td>
            </tr>
            <tr>
              <td className="num">{noQuote}</td>
              <td>
                drafts still need the <strong>original quote</strong>
              </td>
              <td>
                <Link href="/admin/entries?filter=noquote">Add quotes</Link>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="admin-section">
        <h2>Coverage</h2>
        <p className="rail-note" style={{ marginBottom: 12 }}>
          Party share across active entries, excluding private reader drafts
          and withdrawn entries. This is catalog balance, not a score.
        </p>
        <table className="ledger">
          <thead>
            <tr>
              <th>Party</th>
              <th style={{ width: 90 }}>Entries</th>
              <th style={{ width: 90 }}>Share</th>
              <th>Add</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map((item) => (
              <tr key={item.party}>
                <td>
                  <strong>{item.party}</strong>
                </td>
                <td className="num">{item.count}</td>
                <td className="num">{item.pct}%</td>
                <td>
                  <Link href={`/admin/entries/new?party=${item.party}`}>
                    Add an entry
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-section">
        <h2>How voting works</h2>
        <div className="guard clear">
          <span className="lbl">One person, one equal vote</span>
          <p>
            Four equal Sarcasm Profile marks create a clearly labeled Board
            provisional class while a clip is new. They never create GP, rank,
            a public-vote advantage, or Hall eligibility. Each verified account
            can vote once per statement; at ten valid votes the public class
            replaces the provisional one and the clip reaches Standings.
          </p>
        </div>
        <p className="rail-note">
          Use <Link href="/admin/entries">Entries</Link> to move clips from
          Draft to Live. Once an entry has ten votes, its public rank and GP
          appear in Standings; Hall eligibility requires 25 votes and Kohinoor
          Class. Manage it in <Link href="/admin/hall">Hall of Fame</Link>.
        </p>
      </section>
    </>
  );
}
