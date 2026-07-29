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
  const readinessCounts = inventory.reduce<Record<string, number>>((acc, item) => {
    acc[item.readiness.key] = (acc[item.readiness.key] ?? 0) + 1;
    return acc;
  }, {});
  const privateDrafts = statements.filter(
    (statement) => statement.status === "private_draft"
  );
  const researchStatements = statements.filter(
    (statement) =>
      statement.status !== "withdrawn" &&
      statement.status !== "private_draft"
  );
  const researchPartyCounts = researchStatements.reduce<Map<string, number>>((counts, statement) => {
    counts.set(statement.party_at_time, (counts.get(statement.party_at_time) ?? 0) + 1);
    return counts;
  }, new Map());
  const cov = [...researchPartyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([party, count]) => ({
      party,
      count,
      pct: Math.round((count / Math.max(researchStatements.length, 1)) * 100),
    }));

  const noQuote = researchStatements.filter((s) => !s.quote).length;
  const unverified = researchStatements.filter(
    (s) => s.verification.stage === "text_sourced"
  ).length;
  const thinSourced = researchStatements.filter(
    (s) => (s.verification.sources ?? []).length < 2
  ).length;
  const noTierAB = researchStatements.filter(
    (s) => !["A", "B"].includes(s.verification.best_source_tier)
  ).length;
  const noVideo = researchStatements.filter((s) => !s.video?.id).length;

  return (
    <>
      <section className="admin-cards">
        <div className="admin-card">
          <span className="lbl">Indexed</span>
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
          <span className="lbl">Private submissions</span>
          <b className="num">{privateDrafts.length}</b>
        </div>
        <div className="admin-card">
          <span className="lbl">Production / needs video</span>
          <b className="num">
            {(readinessCounts.production_review ?? 0) + (readinessCounts.needs_video ?? 0)}
          </b>
        </div>
        <div className="admin-card">
          <span className="lbl">Withdrawn</span>
          <b className="num">{readinessCounts.withdrawn ?? 0}</b>
        </div>
      </section>

      <section className="admin-section">
        <h2>What needs work</h2>
        <p className="rail-note" style={{ marginBottom: 12 }}>
          These are outstanding tasks, not errors. Nothing here blocks you from editing.
        </p>
        <table className="ledger">
          <tbody>
            <tr>
              <td className="num">{privateDrafts.length}</td>
              <td>
                accepted reader submissions are <strong>private drafts</strong>
                {" "}until you explicitly publish them
              </td>
              <td><Link href="/admin/entries?filter=private">Review privately</Link></td>
            </tr>
            <tr>
              <td className="num">{readinessCounts.ready ?? 0}</td>
              <td>
                entries have passed every check and are <strong>ready to go live</strong>
              </td>
              <td><Link href="/admin/entries?filter=ready">Review and publish</Link></td>
            </tr>
            <tr>
              <td className="num">{readinessCounts.production_review ?? 0}</td>
              <td>
                entries have footage but still need <strong>production or committee review</strong>
              </td>
              <td><Link href="/admin/entries?filter=production">Continue review</Link></td>
            </tr>
            <tr>
              <td className="num">{unverified}</td>
              <td>
                entries are still <strong>text-sourced</strong> and not verified for publication
              </td>
              <td><Link href="/admin/entries?filter=unverified">Review</Link></td>
            </tr>
            <tr>
              <td className="num">{noVideo}</td>
              <td>entries have <strong>no video attached</strong> — the clip is what makes an entry publishable</td>
              <td><Link href="/admin/entries?filter=novideo">Add videos</Link></td>
            </tr>
            <tr>
              <td className="num">{noQuote}</td>
              <td>
                entries have <strong>no established verbatim quote</strong> and show a neutral title instead
              </td>
              <td><Link href="/admin/entries?filter=noquote">Find wording</Link></td>
            </tr>
            <tr>
              <td className="num">{thinSourced}</td>
              <td>entries rest on a <strong>single source</strong> — corroboration is required below Tier A</td>
              <td><Link href="/admin/entries?filter=thin">Corroborate</Link></td>
            </tr>
            <tr>
              <td className="num">{noTierAB}</td>
              <td>entries have <strong>no Tier A or B source</strong> at all</td>
              <td><Link href="/admin/entries?filter=tierc">Source</Link></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="admin-section">
        <h2>Coverage</h2>
        <p className="rail-note" style={{ marginBottom: 12 }}>
          Party share of the public research record, excluding private submissions and withdrawn
          files. This measures where the research has looked; it is not a score or a live-ladder
          result.
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
            {cov.map((c) => (
              <tr key={c.party}>
                <td><strong>{c.party}</strong></td>
                <td className="num">{c.count}</td>
                <td className="num">{c.pct}%</td>
                <td>
                  <Link href={`/admin/entries/new?party=${c.party}`}>Add an entry</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-section">
        <h2>How public ranking works</h2>
        <div className="guard clear">
          <span className="lbl">Equal-weight public rulings only</span>
          <p>
            Internal research axes do not create a rank, GP or starting advantage. Every valid
            user ruling has equal strength, each verified account can rule once per statement,
            and a live entry reaches Standings only after ten real rulings.
          </p>
        </div>
        <p className="rail-note">
          Use <Link href="/admin/entries">Entries</Link> to finish publication work. Once an entry
          has ten rulings, its real public rank and GP are available in{" "}
          <Link href="/admin/hall">Hall candidates</Link>.
        </p>
      </section>
    </>
  );
}
