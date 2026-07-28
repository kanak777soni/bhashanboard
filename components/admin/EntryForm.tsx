import { AXIS_LABELS, AXIS_WEIGHTS, type StoredPolitician, type StoredStatement } from "@/lib/store";
import {
  MAX_VIDEO_EXCERPT_SECONDS,
  normalizeStatementVideo,
  normalizeVerificationStage,
} from "@/lib/video";
import R2VideoUploadField from "./R2VideoUploadField";

const CATEGORIES = ["Science & Reason", "History", "Economics", "Whataboutery", "Standing Ovation"];
const LANGUAGES = ["Hindi", "English", "Bengali", "Tamil", "Telugu", "Marathi", "Kannada", "Malayalam", "Gujarati", "Punjabi", "Odia", "Assamese"];

/**
 * The full editor. Every field the corpus carries is here, including the
 * axis scores that determine rank — editing those is how you move an entry
 * up or down the board, and each edit is written to the audit log.
 */
export default function EntryForm({
  entry,
  people,
  parties,
  action,
  submitLabel,
}: {
  entry?: StoredStatement;
  people: StoredPolitician[];
  parties: { id: string; name: string }[];
  action: (fd: FormData) => void;
  submitLabel: string;
}) {
  const v = entry?.verification;
  const sources = v?.sources ?? [];
  const verificationStage = normalizeVerificationStage(v?.stage);
  const initialVideo = normalizeStatementVideo(entry?.video);

  return (
    <form action={action} className="admin-form">
      {entry && (
        <>
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="version" value={entry.version} />
        </>
      )}

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
            <select name="language" defaultValue={entry?.language ?? "Hindi"}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
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
        <legend>The video</legend>
        <p className="rail-note">
          Prefer a source-platform embed when it is stable. For rights-cleared evidence, upload a
          browser-ready MP4 directly to Cloudflare R2. Uploaded files are not transcoded: they must
          already use H.264 video, AAC audio and fast-start layout, and a trusted administrator must
          play the promoted clip through once before attaching it. Every excerpt may be at most{" "}
          {MAX_VIDEO_EXCERPT_SECONDS / 60} minutes.
        </p>
        <R2VideoUploadField initialVideo={initialVideo} />
      </fieldset>

      <fieldset>
        <legend>Scoring — this is what sets the rank</legend>
        <p className="rail-note">
          Each axis is 0&ndash;5. The weighted total orders the whole board, and GP is then fitted to the
          tier bands. <strong>Consequence is inverted</strong>: 5 means nothing happened or a promotion
          followed; 0 means they resigned. Changes here are recorded in the audit log with the old and new
          values.
        </p>
        <div className="axis-editor">
          {Object.keys(AXIS_WEIGHTS).map((k) => (
            <label className="field" key={k}>
              <span className="lbl">
                {AXIS_LABELS[k]} &middot; weight {AXIS_WEIGHTS[k]}
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

      <fieldset>
        <legend>Sources and verification</legend>
        <div className="admin-grid">
          <label className="field">
            <span className="lbl">Verification stage</span>
            <select name="stage" defaultValue={verificationStage}>
              <option value="text_sourced">text_sourced — reported, not yet verified</option>
              <option value="av_verified">av_verified — video and timestamps in hand</option>
              <option value="committee_passed">committee_passed — transcript, context and sign-off complete</option>
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
          <textarea name="needs" defaultValue={(v?.needs ?? []).join("\n")} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Placement</legend>
        <div className="admin-grid">
          <label className="field">
            <span className="lbl">Status</span>
            <select name="status" defaultValue={entry?.status ?? "held_review"}>
              <option value="published">published — on the ladder</option>
              <option value="held_review">held_review — indexed, awaiting review</option>
              <option value="held_parity">held_parity — indexed, held back</option>
              <option value="withdrawn">withdrawn — off the board</option>
            </select>
          </label>
          {entry && (
            <label className="field checkbox">
              <input type="checkbox" name="hall_of_fame" defaultChecked={entry.hall_of_fame} />
              <span>Induct into the Hall of Fame</span>
            </label>
          )}
        </div>
      </fieldset>

      <div className="admin-submit">
        <button className="btn seal" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
