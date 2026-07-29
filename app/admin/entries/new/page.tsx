import EntryForm from "@/components/admin/EntryForm";
import { cloudinaryConfigurationIssues } from "@/lib/cloudinary-config";
import { requireAdmin } from "@/lib/require-admin";
import { getParties, getPoliticians } from "@/lib/store";
import {
  createStatementDraft,
  publishNewStatement,
} from "../../actions";

export default async function NewEntry() {
  await requireAdmin();
  const [people, parties] = await Promise.all([getPoliticians(), getParties()]);
  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>Add an entry</h2>
      </div>
      <p className="rail-note" style={{ marginBottom: 16 }}>
        New entries default to <strong>held for review</strong>. Nothing reaches the ladder without you
        placing it. If the exact wording is not established, leave the quote empty — the site will show the
        neutral title unquoted rather than presenting a paraphrase as a quotation. Store a sourced remark in
        its original language and put the faithful English rendering in the separate translation field.
      </p>
      <EntryForm
        people={people}
        parties={parties}
        saveAction={createStatementDraft}
        publishAction={publishNewStatement}
        cloudinaryConfigurationIssues={cloudinaryConfigurationIssues()}
      />
    </section>
  );
}
