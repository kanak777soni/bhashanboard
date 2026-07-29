import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";
import { getData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Refused",
  description:
    "Statements proposed for the archive and refused under the Rules of the Board, each recorded with the rule that killed it.",
};

export default async function RejectedPage() {
  const { REJECTED, REJECTION_RULES } = await getData();
  return (
    <SiteFrame>
      <div className="sec-head" style={{ marginTop: 26 }}>
        <h1>Refused</h1>
        <span className="lbl">The rules, applied</span>
      </div>

      <p className="prose" style={{ marginTop: 16 }}>
        Every statement below was proposed for the archive and refused. Each carries the rule that
        killed it and the reasoning. This page exists because a content policy that is advertised but
        never shown to bite is worth nothing &mdash; and because it stops the same famous clip being
        proposed again every month.
      </p>
      <p className="prose">
        Some of these were expensive to refuse. Several are among the most-viewed political remarks of
        their year. They are not here on the merits; they are not here because they broke a rule.
      </p>

      {Object.keys(REJECTION_RULES).length > 0 && (
        <div className="rules-key">
          <span className="lbl">The rules invoked</span>
          <dl>
            {Object.entries(REJECTION_RULES).map(([code, text]) => (
              <div key={code}>
                <dt className="kind">{code}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="tablewrap" style={{ marginTop: 24 }}>
        <table className="ledger">
          <thead>
            <tr>
              <th style={{ width: 74 }}>Date</th>
              <th style={{ width: 54 }}>Rule</th>
              <th>Statement, and why it is not in the archive</th>
            </tr>
          </thead>
          <tbody>
            {REJECTED.map((r, i) => (
              <tr key={i}>
                <td className="num" style={{ fontSize: 13 }}>
                  {r.date}
                </td>
                <td>
                  <span className="kind withdrawal">{r.rule}</span>
                </td>
                <td>
                  <strong>{r.descriptor}</strong>
                  <div style={{ fontSize: 13.5, color: "var(--ink-45)", margin: "3px 0 6px" }}>
                    {r.attributedTo}
                  </div>
                  {r.reasoning && <div style={{ fontSize: 14.5 }}>{r.reasoning}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="legend-foot" style={{ marginTop: 18 }}>
        Refusals are per statement, not per speech. A refused line does not taint the entry beside it,
        and an indexed entry does not launder the line beside it.{" "}
        <Link href="/rules">The Rules of the Board</Link>.
      </p>
    </SiteFrame>
  );
}
