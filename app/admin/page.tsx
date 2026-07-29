import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { statementReadiness } from "@/lib/readiness";
import { computeLadder, getStatements, weightedScore } from "@/lib/store";

export default async function AdminOverview() {
  await requireAdmin();
  const statements = await getStatements();
  const inventory = statements.map((statement) => ({
    statement,
    readiness: statementReadiness(statement),
  }));
  const liveStatements = inventory
    .filter(({ readiness }) => readiness.key === "live")
    .map(({ statement }) => statement);
  const ladder = computeLadder(liveStatements);
  const gpById = new Map(ladder.map((l) => [l.id, l]));
  const readinessCounts = inventory.reduce<Record<string, number>>((acc, item) => {
    acc[item.readiness.key] = (acc[item.readiness.key] ?? 0) + 1;
    return acc;
  }, {});
  const researchStatements = statements.filter((statement) => statement.status !== "withdrawn");
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

  const top = ladder.slice(0, 10).map((l) => ({ ...l, s: statements.find((x) => x.id === l.id)! }));
  const headParty = cov[0];
  const headShare = top.filter((t) => t.s.party_at_time === headParty?.party).length;

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
          Party share of the indexed research record, excluding withdrawn files. This measures where
          the research has looked; it is not a score or a live-ladder result.
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
        {headParty && top.length > 0 && (
          <p className="rail-note" style={{ marginTop: 12 }}>
            <strong>{headParty.party}</strong> accounts for {headParty.pct}% of the indexed research
            record and {headShare} of the first ten positions in the administrative seed order.
          </p>
        )}
      </section>

      <section className="admin-section">
        <h2>Editorial seed order</h2>
        <div className="tablewrap">
          <table className="ledger">
            <thead>
              <tr>
                <th style={{ width: 44 }}>Seed</th>
                <th style={{ width: 64 }}>Seed GP</th>
                <th style={{ width: 58 }}>Score</th>
                <th>Entry</th>
                <th style={{ width: 64 }}>Party</th>
                <th style={{ width: 60 }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {top.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No statement has completed publication review yet.
                  </td>
                </tr>
              )}
              {top.map((t) => (
                <tr key={t.id}>
                  <td className="num">{t.rank}</td>
                  <td className="num">{t.gp}</td>
                  <td className="num">{weightedScore(t.s.axes).toFixed(2)}</td>
                  <td>
                    {t.s.neutral_title}
                    {t.s.hall_of_fame && <span className="tag-new" style={{ marginLeft: 6 }}>HOF</span>}
                  </td>
                  <td>{t.s.party_at_time}</td>
                  <td><Link href={`/admin/entries/${t.id}`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rail-note" style={{ marginTop: 12 }}>
          This is an administrative prior, not a public rank. A live statement displays no public
          rank or class until ten valid rulings exist; {gpById.size} entries currently have a frozen
          editorial starting position.
        </p>
      </section>
    </>
  );
}
