import { getAudit } from "@/lib/store";

export default async function AdminAudit() {
  const log = await getAudit();
  return (
    <section className="admin-section">
      <h2>Audit log</h2>
      <p className="rail-note" style={{ marginBottom: 14 }}>
        Every write from this dashboard, in order. Rating changes record the old and new value of each axis
        that moved. This is what makes an editable ladder defensible rather than steerable — the site
        publishes a ledger claiming it keeps score of itself, and this is that score.
      </p>
      <div className="tablewrap">
        <table className="ledger">
          <thead><tr><th style={{ width: 150 }}>When</th><th style={{ width: 90 }}>Action</th><th style={{ width: 80 }}>Entry</th><th>Detail</th></tr></thead>
          <tbody>
            {log.length === 0 && <tr><td colSpan={4} className="empty">Nothing recorded yet.</td></tr>}
            {log.map((e, i) => (
              <tr key={i}>
                <td className="num" style={{ fontSize: 12 }}>{e.at.replace("T", " ").slice(0, 16)}</td>
                <td><span className={`kind ${e.action === "withdraw" ? "withdrawal" : e.action === "create" ? "reply" : "correction"}`}>{e.action}</span></td>
                <td className="num" style={{ fontSize: 12 }}>{e.target}</td>
                <td style={{ fontSize: 14.5 }}>{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
