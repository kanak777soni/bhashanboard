import Link from "next/link";
import { notFound } from "next/navigation";
import EntryForm from "@/components/admin/EntryForm";
import { cloudinaryConfigurationIssues } from "@/lib/cloudinary-config";
import { slugify } from "@/lib/corpus";
import { statementReadiness } from "@/lib/readiness";
import { requireAdmin } from "@/lib/require-admin";
import { getParties, getPoliticians, getStatement } from "@/lib/store";
import { updateStatement } from "../../actions";

export default async function EditEntry({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const entry = await getStatement(id);
  if (!entry) notFound();

  const [people, parties] = await Promise.all([getPoliticians(), getParties()]);
  const readiness = statementReadiness(entry);

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>{entry.neutral_title}</h2>
          <Link className="btn ghost" href="/admin/entries">Back to entries</Link>
        </div>
        <div className="admin-cards">
          <div className="admin-card"><span className="lbl">Entry</span><b className="num">{entry.id}</b></div>
          <div className="admin-card"><span className="lbl">Public state</span><b>{readiness.label}</b></div>
          <div className="admin-card"><span className="lbl">Video</span><b>{entry.video?.platform ?? "none"}</b></div>
          <div className="admin-card"><span className="lbl">Verification</span><b>{entry.verification.stage.replaceAll("_", " ")}</b></div>
          <div className="admin-card"><span className="lbl">Outstanding</span><b className="num">{entry.verification.needs?.length ?? 0}</b></div>
          <div className="admin-card"><span className="lbl">Quote</span><b className="num">{entry.quote ? "yes" : "none"}</b></div>
        </div>
        <p className="rail-note" style={{ marginTop: 12 }}>
          {entry.status === "private_draft" ? (
            "Private submission draft — no public URL exists until publication."
          ) : (
            <Link href={`/statement/${slugify(`${entry.neutral_title}-${entry.id}`)}`}>
              View this entry on the public site ↗
            </Link>
          )}
        </p>
      </section>

      <section className="admin-section">
        <EntryForm
          entry={entry}
          people={people}
          parties={parties}
          action={updateStatement}
          cloudinaryConfigurationIssues={cloudinaryConfigurationIssues()}
        />
      </section>
    </>
  );
}
