import Link from "next/link";
import { getParties, getPoliticians, getStatements } from "@/lib/store";
import { createPolitician } from "../actions";

export default async function AdminPeople() {
  const [people, parties, statements] = await Promise.all([getPoliticians(), getParties(), getStatements()]);
  const counts = new Map<string, number>();
  statements.forEach((s) => counts.set(s.speaker_id, (counts.get(s.speaker_id) ?? 0) + 1));
  const sorted = [...people].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));

  return (
    <>
      <section className="admin-section">
        <h2>Add a representative</h2>
        <form action={createPolitician} className="admin-form">
          <div className="admin-grid">
            <label className="field"><span className="lbl">Name</span><input name="name" required /></label>
            <label className="field">
              <span className="lbl">Party</span>
              <select name="party" required>
                <option value="">Select…</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
              </select>
            </label>
            <label className="field"><span className="lbl">State</span><input name="state" /></label>
            <label className="field"><span className="lbl">Note — office, tenure</span><input name="notes" /></label>
          </div>
          <div className="admin-submit"><button className="btn seal" type="submit">Add representative</button></div>
        </form>
      </section>

      <section className="admin-section">
        <h2>On record</h2>
        <div className="tablewrap">
          <table className="ledger">
            <thead><tr><th>Name</th><th style={{ width: 70 }}>Party</th><th style={{ width: 150 }}>State</th><th style={{ width: 80 }}>Entries</th><th style={{ width: 90 }} /></tr></thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}<div className="entry-sub">{p.notes ?? p.id}</div></td>
                  <td>{p.party}</td>
                  <td style={{ fontSize: 14 }}>{p.state}</td>
                  <td className="num">{counts.get(p.id) ?? 0}</td>
                  <td><Link href={`/admin/entries?q=${encodeURIComponent(p.name)}`}>Entries</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
