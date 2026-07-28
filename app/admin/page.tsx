import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { computeLadder, coverage, getStatements, weightedScore } from "@/lib/store";

export default async function AdminOverview() {
  await requireAdmin();
  const statements = await getStatements();
  const ladder = computeLadder(statements);
  const gpById = new Map(ladder.map((l) => [l.id, l]));
  const byStatus = statements.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  const cov = coverage(statements);

  const noQuote = statements.filter((s) => !s.quote).length;
  const unverified = statements.filter((s) => s.verification.stage === "text_sourced").length;
  const thinSourced = statements.filter((s) => (s.verification.sources ?? []).length < 2).length;
  const noTierAB = statements.filter((s) => !["A", "B"].includes(s.verification.best_source_tier)).length;
  const noVideo = statements.filter((s) => !s.video?.id).length;

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
          <span className="lbl">On the ladder</span>
          <b className="num">{byStatus.published ?? 0}</b>
        </div>
        <div className="admin-card">
          <span className="lbl">Held</span>
          <b className="num">{(byStatus.held_review ?? 0) + (byStatus.held_parity ?? 0)}</b>
        </div>
        <div className="admin-card">
          <span className="lbl">Withdrawn</span>
          <b className="num">{byStatus.withdrawn ?? 0}</b>
        </div>
        <div className="admin-card">
          <span className="lbl">In Hall of Fame</span>
          <b className="num">{statements.filter((s) => s.hall_of_fame).length}</b>
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
          Party share of the live ladder. This measures where the research has looked. Close a gap by
          adding entries, not by changing ratings — a rating edit is logged and visible.
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
        {headParty && (
          <p className="rail-note" style={{ marginTop: 12 }}>
            <strong>{headParty.party}</strong> holds {headShare} of the top ten places and {headParty.pct}% of
            the ladder.
          </p>
        )}
      </section>

      <section className="admin-section">
        <h2>Top of the ladder</h2>
        <div className="tablewrap">
          <table className="ledger">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th style={{ width: 64 }}>GP</th>
                <th style={{ width: 58 }}>Score</th>
                <th>Entry</th>
                <th style={{ width: 64 }}>Party</th>
                <th style={{ width: 60 }}>Edit</th>
              </tr>
            </thead>
            <tbody>
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
          Rank is derived from the five axis scores, weighted, then fitted to the tier bands. To move an
          entry up or down, edit its axes — {gpById.size} entries are currently placed.
        </p>
      </section>
    </>
  );
}
