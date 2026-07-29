import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { getData } from "@/lib/data";
import { hallEligibility } from "@/lib/hall";
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
      {
        rank: index + 1,
        gp: statement.gp,
        votes: statement.rating.validVoteCount,
        eligibility: hallEligibility(statement),
      },
    ])
  );

  const inducted = statements.filter((s) => s.hall_of_fame);
  const candidates = statements
    .filter(
      (s) =>
        !s.hall_of_fame &&
        statementReadiness(s).key === "live" &&
        publicPlacements.get(s.id)?.eligibility.eligible === true
    )
    .sort(
      (a, b) =>
        (publicPlacements.get(a.id)?.rank ?? 9999) -
        (publicPlacements.get(b.id)?.rank ?? 9999)
    )
    .slice(0, 20);
  const road = statements
    .filter(
      (s) =>
        !s.hall_of_fame &&
        statementReadiness(s).key === "live" &&
        publicPlacements.has(s.id) &&
        publicPlacements.get(s.id)?.eligibility.eligible !== true
    )
    .sort(
      (a, b) =>
        (publicPlacements.get(a.id)?.rank ?? 9999) -
        (publicPlacements.get(b.id)?.rank ?? 9999)
    )
    .slice(0, 20);

  const row = (
    s: (typeof statements)[number],
    action?: string
  ) => {
    const placement = publicPlacements.get(s.id);
    const eligibility = placement?.eligibility;
    const progress = eligibility?.eligible
      ? "Ready to induct"
      : [
          eligibility?.remainingVotes
            ? `${eligibility.remainingVotes} votes short`
            : "",
          eligibility?.remainingGp
            ? `${eligibility.remainingGp} GP short`
            : "",
        ]
          .filter(Boolean)
          .join(" · ") || "Not publicly ranked";

    return (
      <tr key={s.id}>
        <td className="num">{placement?.rank ?? "—"}</td>
        <td className="num">{placement?.gp ?? "—"}</td>
        <td className="num">{placement?.votes ?? "—"}</td>
        <td>
          <Link href={`/admin/entries/${s.id}`}>{s.neutral_title}</Link>
          <div className="entry-sub">
            {people.get(s.speaker_id)?.name} · {s.party_at_time}
          </div>
        </td>
        <td className="entry-sub">{progress}</td>
        <td>
          {action ? (
            <form action={toggleHallOfFame}>
              <input type="hidden" name="id" value={s.id} />
              <button className="linkbtn" type="submit">{action}</button>
            </form>
          ) : (
            <span className="entry-sub">Waiting</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <>
      <section className="admin-section">
        <h2>Hall of Fame</h2>
        <p className="rail-note" style={{ marginBottom: 14 }}>
          The Hall is for crowd favourites worth keeping on permanent display.
          Induction requires Kohinoor Class and 25 valid public votes. Adding
          or removing an entry never changes its votes, rank or GP.
        </p>
        <div className="tablewrap">
          <table className="ledger">
            <thead><tr><th style={{ width: 44 }}>#</th><th style={{ width: 60 }}>GP</th><th style={{ width: 60 }}>Votes</th><th>Entry</th><th>Eligibility</th><th style={{ width: 100 }} /></tr></thead>
            <tbody>
              {inducted.length === 0 && <tr><td colSpan={6} className="empty">The Hall is empty for now.</td></tr>}
              {inducted.map((s) => row(s, "Remove from Hall"))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Eligible for induction</h2>
        <p className="rail-note" style={{ marginBottom: 14 }}>
          These clips have reached both published Hall requirements. Their rank
          and GP come entirely from public votes.
        </p>
        <div className="tablewrap">
          <table className="ledger">
            <thead><tr><th style={{ width: 44 }}>#</th><th style={{ width: 60 }}>GP</th><th style={{ width: 60 }}>Votes</th><th>Entry</th><th>Eligibility</th><th style={{ width: 100 }} /></tr></thead>
            <tbody>
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No clip has reached 25 votes and Kohinoor Class yet.
                  </td>
                </tr>
              )}
              {candidates.map((s) => row(s, "Add to Hall"))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Road to the Hall</h2>
        <p className="rail-note" style={{ marginBottom: 14 }}>
          Publicly ranked clips still working toward the induction bar. They
          cannot be added early.
        </p>
        <div className="tablewrap">
          <table className="ledger">
            <thead><tr><th style={{ width: 44 }}>#</th><th style={{ width: 60 }}>GP</th><th style={{ width: 60 }}>Votes</th><th>Entry</th><th>Still needed</th><th style={{ width: 100 }} /></tr></thead>
            <tbody>
              {road.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No publicly ranked clip is on the road yet.
                  </td>
                </tr>
              )}
              {road.map((s) => row(s))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
