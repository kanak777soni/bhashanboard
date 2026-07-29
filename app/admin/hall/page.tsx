import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { getData } from "@/lib/data";
import { statementReadiness } from "@/lib/readiness";
import { getPoliticians, getStatements } from "@/lib/store";
import { toggleHallOfFame } from "../actions";

export default async function AdminHall() {
  await requireAdmin();
  const statements = await getStatements();
  const publicData = await getData();
  const people = new Map((await getPoliticians()).map((p) => [p.id, p]));
  const publicPlacements = new Map(
    publicData.publicRankedStatements().map((statement, index) => [
      statement.corpusId,
      { rank: index + 1, gp: statement.gp },
    ])
  );

  const inducted = statements.filter((s) => s.hall_of_fame);
  const candidates = statements
    .filter(
      (s) =>
        !s.hall_of_fame &&
        statementReadiness(s).key === "live" &&
        publicPlacements.has(s.id)
    )
    .sort(
      (a, b) =>
        (publicPlacements.get(a.id)?.rank ?? 9999) -
        (publicPlacements.get(b.id)?.rank ?? 9999)
    )
    .slice(0, 20);

  const row = (s: (typeof statements)[number], action: string) => (
    <tr key={s.id}>
      <td className="num">{publicPlacements.get(s.id)?.rank ?? "—"}</td>
      <td className="num">{publicPlacements.get(s.id)?.gp ?? "—"}</td>
      <td>
        <Link href={`/admin/entries/${s.id}`}>{s.neutral_title}</Link>
        <div className="entry-sub">{people.get(s.speaker_id)?.name} · {s.party_at_time}</div>
      </td>
      <td>
        <form action={toggleHallOfFame}>
          <input type="hidden" name="id" value={s.id} />
          <button className="linkbtn" type="submit">{action}</button>
        </form>
      </td>
    </tr>
  );

  return (
    <>
      <section className="admin-section">
        <h2>Hall of Fame</h2>
        <p className="rail-note" style={{ marginBottom: 14 }}>
          Induction places an entry in the permanent gallery without changing its rating. It is a deliberate
          editorial act, so it remains manual and every change is written to the audit log.
        </p>
        <div className="tablewrap">
          <table className="ledger">
            <thead><tr><th style={{ width: 44 }}>#</th><th style={{ width: 60 }}>GP</th><th>Inducted</th><th style={{ width: 100 }} /></tr></thead>
            <tbody>
              {inducted.length === 0 && <tr><td colSpan={4} className="empty">No inductions yet. The first is below.</td></tr>}
              {inducted.map((s) => row(s, "Remove"))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Standing candidates</h2>
        <p className="rail-note" style={{ marginBottom: 14 }}>
          A candidate must be live, video-backed, and publicly ranked after at
          least ten valid rulings. Editorial seed order is not a Hall
          qualification.
        </p>
        <div className="tablewrap">
          <table className="ledger">
            <thead><tr><th style={{ width: 44 }}>#</th><th style={{ width: 60 }}>GP</th><th>Entry</th><th style={{ width: 100 }} /></tr></thead>
            <tbody>
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    No live entry has reached the public Hall threshold yet.
                  </td>
                </tr>
              )}
              {candidates.map((s) => row(s, "Induct"))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
