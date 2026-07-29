import Link from "next/link";
import { requireVerifiedUser } from "@/lib/auth-guards";
import { getData } from "@/lib/data";
import { getUserVoteHistory } from "@/lib/vote-store";

const VALUE_LABELS: Record<number, string> = {
  0: "Flat",
  25: "Wry",
  50: "Sharp",
  75: "Savage",
  100: "Historic",
};

export const dynamic = "force-dynamic";

export default async function AccountVotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireVerifiedUser();
  const requestedPage = Number.parseInt((await searchParams).page ?? "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = 20;
  const [history, data] = await Promise.all([
    getUserVoteHistory(user.id, { limit, offset: (page - 1) * limit }),
    getData(),
  ]);
  const slugById = new Map(data.CORPUS.map((statement) => [statement.corpusId, statement.slug]));
  const pageCount = Math.max(1, Math.ceil(history.total / limit));

  return (
    <section className="admin-section" style={{ maxWidth: 760, margin: "28px auto 60px" }}>
      <span className="lbl" style={{ color: "var(--seal)" }}>Your record</span>
      <h1 style={{ margin: "8px 0 16px" }}>Your votes</h1>
      {history.items.length === 0 ? (
        <div className="committee-note">
          <span className="lbl">No votes yet</span>
          <p>
            Finish a clip and vote; it will appear here. Each statement accepts
            one final vote from this account. <Link href="/watch">Open the clips.</Link>
          </p>
        </div>
      ) : (
        <>
          <p className="rail-note" style={{ marginBottom: 14 }}>
            {history.total.toLocaleString("en-IN")} final vote{history.total === 1 ? "" : "s"}.
            Votes cannot be changed; an excluded vote remains visible here for
            auditability.
          </p>
          <table className="ledger">
            <thead>
              <tr><th>Statement</th><th>Vote</th><th>Entered</th><th>Status</th></tr>
            </thead>
            <tbody>
              {history.items.map((item) => {
                const slug = slugById.get(item.statementId);
                return (
                  <tr key={item.voteId}>
                    <td>
                      {slug ? <Link href={`/statement/${slug}`}>{item.neutralTitle}</Link> : item.neutralTitle}
                      <div className="lbl" style={{ marginTop: 3 }}>{item.statementId}</div>
                    </td>
                    <td><span className="num">{item.value}</span> · {VALUE_LABELS[item.value]}</td>
                    <td>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td><span className={`kind ${item.excluded ? "correction" : "integrity"}`}>{item.excluded ? "Excluded" : "Counted"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pageCount > 1 && (
            <nav className="compare-links" aria-label="Vote history pages">
              {page > 1 && <Link className="token" href={`/account/votes?page=${page - 1}`}>Previous</Link>}
              <span className="lbl">Page {Math.min(page, pageCount)} of {pageCount}</span>
              {page < pageCount && <Link className="token" href={`/account/votes?page=${page + 1}`}>Next</Link>}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
