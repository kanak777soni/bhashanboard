import type { Metadata } from "next";
import SiteFrame from "@/components/SiteFrame";
import { LEDGER } from "@/lib/data";

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

export default function LedgerPage() {
  return (
    <SiteFrame>
      <div className="sec-head" style={{ marginTop: 26 }}>
        <h1>The Ledger</h1>
        <span className="lbl">We keep score of ourselves</span>
      </div>

      <p className="prose" style={{ marginTop: 16 }}>
        Every removal, correction, re-contextualisation, right of reply, neutrality audit and
        vote-integrity report is recorded here, permanently, in the order it happened. Nothing is
        removed from this page. It is deliberately the least designed page on the site.
      </p>

      <div className="tablewrap" style={{ marginTop: 20 }}>
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
    </SiteFrame>
  );
}
