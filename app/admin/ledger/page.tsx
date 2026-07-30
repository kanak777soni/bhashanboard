import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { requireAdmin } from "@/lib/require-admin";

export const metadata: Metadata = {
  title: "The Ledger",
  description:
    "Every correction, withdrawal, right of reply, neutrality audit and vote-integrity report, in one chronological record.",
};

const KIND_LABEL: Record<string, string> = {
  withdrawal: "Withdrawn",
  correction: "Corrected",
  reply: "Reply",
  audit: "Audit",
  integrity: "Integrity",
};

export default async function LedgerPage() {
  await requireAdmin();
  const { LEDGER } = await getData();
  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span className="lbl">Board Desk only</span>
          <h2>The Ledger</h2>
        </div>
        <span className="lbl">We keep score of ourselves</span>
      </div>

      <p className="rail-note" style={{ marginBottom: 16 }}>
        Every removal, correction, re-contextualisation, right of reply, neutrality audit and
        vote-integrity report is recorded here, permanently, in the order it happened. Nothing is
        removed from this page. During the early build, this record remains visible only to
        administrators and can be opened publicly later.
      </p>

      <div className="tablewrap">
        <table className="ledger">
          <thead>
            <tr>
              <th style={{ width: 108 }}>Date</th>
              <th style={{ width: 108 }}>Kind</th>
              <th>Entry</th>
            </tr>
          </thead>
          <tbody>
            {LEDGER.map((e, i) => (
              <tr key={i}>
                <td className="num" style={{ fontSize: 13 }}>{e.date}</td>
                <td>
                  <span className={`kind ${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                </td>
                <td>{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
