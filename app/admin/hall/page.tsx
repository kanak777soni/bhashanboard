import Link from "next/link";
import { computeLadder, getPoliticians, getStatements } from "@/lib/store";
import { toggleHallOfFame } from "../actions";

export default async function AdminHall() {
  const statements = await getStatements();
  const people = new Map((await getPoliticians()).map((p) => [p.id, p]));
  const ladder = new Map(computeLadder(statements).map((l) => [l.id, l]));

  const inducted = statements.filter((s) => s.hall_of_fame);
  const candidates = statements
    .filter((s) => !s.hall_of_fame && s.status === "published")
    .sort((a, b) => (ladder.get(a.id)?.rank ?? 9999) - (ladder.get(b.id)?.rank ?? 9999))
    .slice(0, 20);

  const row = (s: (typeof statements)[number], action: string) => (
    <tr key={s.id}>
      <td className="num">{ladder.get(s.id)?.rank ?? "—"}</td>
      <td className="num">{ladder.get(s.id)?.gp ?? "—"}</td>
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
          Induction retires an entry from active duelling into the permanent gallery. It is the one
          editorial act the Committee performs on the board itself, so it is deliberately manual, and each
          induction is written to the audit log.
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
        <div className="tablewrap">
          <table className="ledger">
            <thead><tr><th style={{ width: 44 }}>#</th><th style={{ width: 60 }}>GP</th><th>Entry</th><th style={{ width: 100 }} /></tr></thead>
            <tbody>{candidates.map((s) => row(s, "Induct"))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
