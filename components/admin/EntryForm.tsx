import { AXIS_LABELS, AXIS_WEIGHTS, type StoredPolitician, type StoredStatement } from "@/lib/store";
import { SOURCE_ROLES, type SourceRole } from "@/lib/types";
import {
  committeePublicationIssues,
  MAX_VIDEO_EXCERPT_SECONDS,
  normalizeStatementVideo,
  normalizeVerificationStage,
} from "@/lib/video";
import CloudinaryVideoUploadField from "./CloudinaryVideoUploadField";
import PublishGuard from "./PublishGuard";

const CATEGORIES = ["Science & Reason", "History", "Economics", "Whataboutery", "Standing Ovation"];
const LANGUAGES = ["Hindi", "English", "Urdu", "Bengali", "Tamil", "Telugu", "Marathi", "Kannada", "Malayalam", "Gujarati", "Punjabi", "Odia", "Assamese", "Nepali", "Konkani"];
const SOURCE_ROLE_LABELS: Record<SourceRole, string> = {
  footage: "Original footage",
  reporting: "Reporting",
  context: "Surrounding context",
  fact_check: "Fact-check",
};

/**
 * The full editor. Every evidence field the corpus carries is here. Internal
 * axes remain editable for research continuity and audit history, but public
 * ranking is derived only from equal-weight community rulings.
 */
export default function EntryForm({
  entry,
  people,
  parties,
  action,
  cloudinaryConfigurationIssues,
}: {
  entry?: StoredStatement;
  people: StoredPolitician[];
  parties: { id: string; name: string }[];
  action: (fd: FormData) => void;
  cloudinaryConfigurationIssues: string[];
}) {
  const v = entry?.verification;
  const sources = v?.sources ?? [];
  const verificationStage = normalizeVerificationStage(v?.stage);
  const initialVideo = normalizeStatementVideo(entry?.video);
  const entryIsLive = Boolean(
    entry && committeePublicationIssues(entry).length === 0
  );
  const entryIsPrivate = entry?.status === "private_draft";

  return (
    <form action={action} className="admin-form">
      {entry && (
        <>
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="version" value={entry.version} />
        </>
      )}

      <div className="admin-workflow">
        <div>
          <span className="lbl">Publication workflow</span>
          <p>Draft &rarr; add video &rarr; verify evidence &rarr; preview &rarr; publish</p>
        </div>
        <span className={`stamp ${entryIsLive ? "green" : "foil"}`}>
          {entryIsLive
            ? "Currently live"
            : entryIsPrivate
              ? "Private submission draft · not public"
            : entry?.status === "published"
              ? "Stored as published · blocked from public"
            : entry?.status === "withdrawn"
              ? "Currently withdrawn"
              : "Currently a research draft"}
        </span>
      </div>

      <fieldset>
        <legend>The statement</legend>

        <label className="field">
          <span className="lbl">Neutral title — what the entry is about, never a verdict</span>
          <input name="neutral_title" defaultValue={entry?.neutral_title} required placeholder="On cloud cover and radar" />
        </label>

        <label className="field">
          <span className="lbl">Verbatim quote — leave empty if the exact wording is not established</span>
          <textarea name="quote" defaultValue={entry?.quote ?? ""} placeholder="Leave blank rather than paraphrasing. An empty quote is a research task; an invented one ends the project." />
        </label>

        <label className="field">
          <span className="lbl">English translation — required for a non-English quote</span>
          <textarea
            name="quote_translation"
            defaultValue={entry?.quote_translation ?? ""}
            placeholder="Translate the sourced quote faithfully; do not replace the original-language text above."
          />
        </label>

        <label className="field">
          <span className="lbl">Note on the quote — required when quote is empty; otherwise record provenance</span>
          <input name="quote_note" defaultValue={entry?.quote_note ?? ""} />
        </label>

        <label className="field">
          <span className="lbl">The indexed claim — neutral summary of what was asserted</span>
          <textarea name="claim" defaultValue={entry?.claim} required />
        </label>

        <label className="field">
          <span className="lbl">Counterpoint — what is actually the case, and how we know</span>
          <textarea name="counterpoint" defaultValue={entry?.counterpoint ?? ""} />
        </label>

        <label className="field">
          <span className="lbl">Context — what surrounds the remark</span>
          <textarea name="context" defaultValue={entry?.context ?? ""} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Who, where, when</legend>
        <div className="admin-grid">
          <label className="field">
            <span className="lbl">Representative</span>
            <select name="speaker_id" defaultValue={entry?.speaker_id} required>
              <option value="">Select…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.party}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lbl">Party at the time</span>
            <select name="party_at_time" defaultValue={entry?.party_at_time} required>
              <option value="">Select…</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lbl">Office at the time</span>
            <input name="office_at_time" defaultValue={entry?.office_at_time} />
          </label>
          <label className="field">
            <span className="lbl">State</span>
            <input name="state" defaultValue={entry?.state} />
          </label>
          <label className="field">
            <span className="lbl">Date</span>
            <input name="date" defaultValue={entry?.date} placeholder="2019-05-11, 2019-05 or 2019" />
          </label>
          <label className="field">
            <span className="lbl">Date precision</span>
            <select name="date_precision" defaultValue={entry?.date_precision ?? "day"}>
              <option value="day">day</option>
              <option value="month">month</option>
              <option value="year">year</option>
            </select>
          </label>
          <label className="field">
            <span className="lbl">Venue</span>
            <input name="venue" defaultValue={entry?.venue} />
          </label>
          <label className="field">
            <span className="lbl">Language</span>
            <input
              name="language"
              list="statement-language-options"
              defaultValue={entry?.language ?? "Hindi"}
              placeholder="Hindi, Urdu, Tamil…"
              required
            />
            <datalist id="statement-language-options">
              {LANGUAGES.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
            <small className="field-help">
              Enter the source language exactly; the list is only a suggestion
              and will not replace another language.
            </small>
          </label>
          <label className="field">
            <span className="lbl">Category</span>
            <select name="category" defaultValue={entry?.category} required>
              <option value="">Select…</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>1. Add the video</legend>
        <p className="rail-note">
          Upload a rights-cleared clip directly, or use a stable YouTube source with exact
          timestamps. The public Watch page only receives a video after the final publication
          checklist passes. Every voting excerpt may be at most{" "}
          {MAX_VIDEO_EXCERPT_SECONDS / 60} minutes.
        </p>
        <CloudinaryVideoUploadField
          initialVideo={initialVideo}
          configurationIssues={cloudinaryConfigurationIssues}
        />
      </fieldset>

      <fieldset>
        <legend>Internal research notes — not public scoring</legend>
        <p className="rail-note">
          These 0&ndash;5 axes preserve the committee&apos;s internal research notes and audit
          history. <strong>They do not set public rank or GP.</strong> Public performance is the
          equal-weight mean of valid one-person, one-vote rulings; an entry reaches Standings after
          ten rulings.
        </p>
        <div className="axis-editor">
          {Object.keys(AXIS_WEIGHTS).map((k) => (
            <label className="field" key={k}>
              <span className="lbl">
                {AXIS_LABELS[k]} &middot; internal weight {AXIS_WEIGHTS[k]}
              </span>
              <select name={k} defaultValue={entry?.axes?.[k] ?? 3}>
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset id="source-evidence">
        <legend>2. Verify the evidence</legend>
        <div className="social-evidence-note">
          <span className="lbl">Facebook and Instagram links are welcome here</span>
          <p>
            Add a public Reel, post or video as <strong>Original footage</strong> evidence.
            Social embeds do not provide dependable watch-progress proof, so the entry still
            needs a bounded YouTube excerpt or rights-cleared Cloudinary upload before voting.
          </p>
        </div>
        <div className="admin-grid">
          <label className="field">
            <span className="lbl">Verification stage</span>
            <select name="stage" defaultValue={verificationStage}>
              <option value="text_sourced">
                Text sourced — quote and sources still under review
              </option>
              <option value="av_verified">
                Production review — video and timestamps in hand
              </option>
              <option value="committee_passed">
                Committee passed — transcript, context and sign-off complete
              </option>
            </select>
          </label>
          <label className="field">
            <span className="lbl">Best source tier</span>
            <select name="best_source_tier" defaultValue={v?.best_source_tier ?? "C"}>
              <option value="A">A — primary feed, official channel</option>
              <option value="B">B — broadcast or major outlet</option>
              <option value="C">C — secondary, needs corroboration</option>
            </select>
          </label>
        </div>

        {[0, 1, 2, 3].map((i) => (
          <div className="admin-grid source-row" key={i}>
            <label className="field">
              <span className="lbl">Source {i + 1} tier</span>
              <select name={`src_tier_${i}`} defaultValue={sources[i]?.tier ?? ""}>
                <option value="">—</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label className="field">
              <span className="lbl">Role</span>
              <select
                name={`src_role_${i}`}
                defaultValue={sources[i]?.role ?? "reporting"}
              >
                {SOURCE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {SOURCE_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="lbl">Publisher</span>
              <input name={`src_publisher_${i}`} defaultValue={sources[i]?.publisher ?? ""} />
            </label>
            <label className="field" style={{ gridColumn: "span 2" }}>
              <span className="lbl">Headline</span>
              <input name={`src_title_${i}`} defaultValue={sources[i]?.title ?? ""} />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="lbl">URL</span>
              <input name={`src_url_${i}`} defaultValue={sources[i]?.url ?? ""} />
            </label>
          </div>
        ))}

        <label className="field">
          <span className="lbl">Outstanding needs — one per line</span>
          <small className="field-help">
            Every line here blocks publication. Delete an item only after the work is complete.
          </small>
          <textarea name="needs" defaultValue={(v?.needs ?? []).join("\n")} />
        </label>
      </fieldset>

      <fieldset>
        <legend>3. Preview and publish</legend>
        <p className="rail-note">
          {entryIsPrivate
            ? "This accepted submission stays private until Publish passes every server check. When publication succeeds, its research record and video become public together."
            : "Saving keeps this as a non-votable research file. Publishing is a separate server-checked action; when it succeeds, the video appears in Watch immediately without a Git push or Vercel deployment."}
        </p>
        <PublishGuard />
      </fieldset>

      <div className="admin-submit">
        <div>
          <button
            className="btn ghost"
            type="submit"
            name="workflow_action"
            value="save_draft"
          >
            {entryIsLive
              ? "Save as draft (take offline)"
              : entryIsPrivate
                ? "Save private draft"
                : "Save draft"}
          </button>
          <span className="admin-submit-note">
            {entryIsPrivate
              ? "Private submission drafts are excluded from every public page."
              : "Research drafts stay in the Record and cannot receive votes."}
          </span>
        </div>
        <button
          className="btn seal"
          type="submit"
          name="workflow_action"
          value="publish"
          data-publish-submit
          disabled
        >
          {entryIsLive ? "Update live video" : "Publish video"}
        </button>
      </div>
    </form>
  );
}
