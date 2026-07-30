import type { StoredPolitician, StoredStatement } from "@/lib/store";
import { SOURCE_ROLES, type SourceRole } from "@/lib/types";
import {
  MAX_VIDEO_EXCERPT_SECONDS,
  normalizeStatementVideo,
  normalizeVerificationStage,
} from "@/lib/video";
import CloudinaryVideoUploadField from "./CloudinaryVideoUploadField";
import PublishGuard from "./PublishGuard";
import SarcasmProfileFields from "./SarcasmProfileFields";

const CATEGORIES = [
  "Science & Reason",
  "History",
  "Economics",
  "Whataboutery",
  "Standing Ovation",
];
const LANGUAGES = [
  "Hindi",
  "English",
  "Urdu",
  "Bengali",
  "Tamil",
  "Telugu",
  "Marathi",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Punjabi",
  "Odia",
  "Assamese",
  "Nepali",
  "Konkani",
];
const SOURCE_ROLE_LABELS: Record<SourceRole, string> = {
  footage: "Original post or footage",
  reporting: "Related coverage",
  context: "More context",
  fact_check: "Background reference",
};

/**
 * The editor follows the actual product: add a clip, give it a clear card,
 * preview it, and decide whether it should be live. Research material remains
 * available backstage but is not part of the publishing path or public score.
 */
export default function EntryForm({
  entry,
  people,
  parties,
  saveAction,
  publishAction,
  restoreAction,
  hasVotes = false,
  profileComplete = false,
  cloudinaryConfigurationIssues,
}: {
  entry?: StoredStatement;
  people: StoredPolitician[];
  parties: { id: string; name: string }[];
  saveAction: (fd: FormData) => void | Promise<void>;
  publishAction: (fd: FormData) => void | Promise<void>;
  restoreAction?: (fd: FormData) => void | Promise<void>;
  hasVotes?: boolean;
  profileComplete?: boolean;
  cloudinaryConfigurationIssues: string[];
}) {
  const verification = entry?.verification;
  const sources = verification?.sources ?? [];
  const verificationStage = normalizeVerificationStage(verification?.stage);
  const initialVideo = normalizeStatementVideo(entry?.video);
  const entryIsLive = entry?.status === "published";
  const canRestoreVotedClip =
    hasVotes && !entryIsLive && Boolean(entry?.status.startsWith("held"));
  const publicationAction: "publish" | "restore_live" | undefined = hasVotes
    ? canRestoreVotedClip
      ? "restore_live"
      : undefined
    : "publish";
  const publicationLabel =
    publicationAction === "restore_live"
      ? "Put unchanged clip back live"
      : entryIsLive
        ? "Update live clip"
        : "Go live";
  const publicationSubmitAction =
    publicationAction === "restore_live" ? restoreAction : publishAction;

  return (
    <form action={saveAction} className="admin-form">
      {entry && (
        <>
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="version" value={entry.version} />
        </>
      )}

      <div className="admin-workflow">
        <div className="admin-workflow-copy">
          <span className="lbl">Publishing</span>
          <div className="admin-workflow-steps" aria-label="Draft, preview, live">
            <strong>Draft</strong>
            <i aria-hidden="true">&rarr;</i>
            <strong>Preview</strong>
            <i aria-hidden="true">&rarr;</i>
            <strong>Live</strong>
          </div>
        </div>
        <span className={`stamp ${entryIsLive ? "green" : "foil"}`}>
          {entryIsLive
            ? "Live now"
            : entry?.status === "withdrawn"
              ? "Offline"
              : "Draft"}
        </span>
      </div>

      <fieldset>
        <legend>1. Add the clip</legend>
        <p className="rail-note">
          Upload a short video or paste a YouTube link. Set the exact YouTube
          start and end points so voters see the intended moment. Clips can be
          up to {MAX_VIDEO_EXCERPT_SECONDS / 60} minutes.
        </p>
        <CloudinaryVideoUploadField
          initialVideo={initialVideo}
          configurationIssues={cloudinaryConfigurationIssues}
        />
      </fieldset>

      <fieldset>
        <legend>2. Make the card</legend>

        <label className="field">
          <span className="lbl">Card title</span>
          <input
            name="neutral_title"
            defaultValue={entry?.neutral_title}
            required
            placeholder="A short title for the moment"
          />
          <small className="field-help">
            Keep it short and descriptive. Let the clip deliver the joke.
          </small>
        </label>

        <label className="field">
          <span className="lbl">Original quote</span>
          <textarea
            name="quote"
            defaultValue={entry?.quote ?? ""}
            required
            placeholder="Write the words as spoken, in their original language."
          />
        </label>

        <label className="field">
          <span className="lbl">English translation</span>
          <textarea
            name="quote_translation"
            defaultValue={entry?.quote_translation ?? ""}
            placeholder="Required only when the original quote is not English."
          />
        </label>

        <div className="admin-grid">
          <label className="field">
            <span className="lbl">Speaker</span>
            <select name="speaker_id" defaultValue={entry?.speaker_id} required>
              <option value="">Select&hellip;</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} &mdash; {person.party}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="lbl">Party at the time</span>
            <select
              name="party_at_time"
              defaultValue={entry?.party_at_time}
              required
            >
              <option value="">Select&hellip;</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.id} &mdash; {party.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="lbl">Original language</span>
            <input
              name="language"
              list="statement-language-options"
              defaultValue={entry?.language ?? "Hindi"}
              placeholder="Hindi, Urdu, Tamil&hellip;"
              required
            />
            <datalist id="statement-language-options">
              {LANGUAGES.map((language) => (
                <option key={language} value={language} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span className="lbl">Category</span>
            <select name="category" defaultValue={entry?.category} required>
              <option value="">Select&hellip;</option>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <details className="admin-optional">
        <summary>Optional card notes and event details</summary>
        <fieldset>
          <legend>Extra details</legend>
          <p className="rail-note">
            These fields can add useful background, but none of them keeps a
            finished clip from going live.
          </p>

          <label className="field">
            <span className="lbl">Short setup (optional)</span>
            <textarea
              name="claim"
              defaultValue={entry?.claim}
              placeholder="One neutral sentence if the quote needs a setup."
            />
          </label>

          <label className="field">
            <span className="lbl">Wording note (optional)</span>
            <input
              name="quote_note"
              defaultValue={entry?.quote_note ?? ""}
              placeholder="Private note about transcription or wording."
            />
          </label>

          <label className="field">
            <span className="lbl">More context (optional)</span>
            <textarea
              name="context"
              defaultValue={entry?.context ?? ""}
              placeholder="What was happening around this moment?"
            />
          </label>

          <label className="field">
            <span className="lbl">Background note (optional)</span>
            <textarea
              name="counterpoint"
              defaultValue={entry?.counterpoint ?? ""}
              placeholder="Add only when it genuinely helps the viewer."
            />
          </label>

          <div className="admin-grid">
            <label className="field">
              <span className="lbl">Office at the time</span>
              <input
                name="office_at_time"
                defaultValue={entry?.office_at_time}
              />
            </label>
            <label className="field">
              <span className="lbl">State</span>
              <input name="state" defaultValue={entry?.state} />
            </label>
            <label className="field">
              <span className="lbl">Date</span>
              <input
                name="date"
                defaultValue={entry?.date}
                placeholder="2019-05-11, 2019-05 or 2019"
              />
            </label>
            <label className="field">
              <span className="lbl">Date precision</span>
              <select
                name="date_precision"
                defaultValue={entry?.date_precision ?? "day"}
              >
                <option value="day">day</option>
                <option value="month">month</option>
                <option value="year">year</option>
              </select>
            </label>
            <label className="field">
              <span className="lbl">Venue</span>
              <input name="venue" defaultValue={entry?.venue} />
            </label>
          </div>
        </fieldset>
      </details>

      {!entry && (
        <details className="admin-optional" open>
          <summary>Sarcasm Profile and provisional class</summary>
          <fieldset>
            <legend>Comic anatomy</legend>
            <p className="rail-note">
              Score the statement or moment, never the person. These four
              0&ndash;5 marks appear publicly and set the Board&rsquo;s
              provisional class. Public GP, rank, and the public class still
              come only from equal member votes.
            </p>
            <SarcasmProfileFields />
          </fieldset>
        </details>
      )}

      <details className="admin-optional" id="source-evidence">
        <summary>Optional links and internal follow-ups</summary>
        <fieldset>
          <legend>Backstage references</legend>
          <p className="rail-note">
            A YouTube link already identifies its source. For an uploaded clip,
            rights are confirmed during upload. Add Facebook, Instagram, news
            or full-speech links here only when they are useful.
          </p>

          <input type="hidden" name="stage" value={verificationStage} />
          <input
            type="hidden"
            name="best_source_tier"
            value={verification?.best_source_tier ?? "A"}
          />

          {[0, 1, 2, 3].map((index) => (
            <div className="admin-grid source-row" key={index}>
              <input
                type="hidden"
                name={`src_tier_${index}`}
                value={sources[index]?.tier ?? "A"}
              />
              <label className="field">
                <span className="lbl">Link {index + 1} type</span>
                <select
                  name={`src_role_${index}`}
                  defaultValue={sources[index]?.role ?? "footage"}
                >
                  {SOURCE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {SOURCE_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="lbl">Publisher or account</span>
                <input
                  name={`src_publisher_${index}`}
                  defaultValue={sources[index]?.publisher ?? ""}
                />
              </label>
              <label className="field" style={{ gridColumn: "span 2" }}>
                <span className="lbl">Description</span>
                <input
                  name={`src_title_${index}`}
                  defaultValue={sources[index]?.title ?? ""}
                />
              </label>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span className="lbl">URL</span>
                <input
                  name={`src_url_${index}`}
                  defaultValue={sources[index]?.url ?? ""}
                  placeholder="https://"
                />
              </label>
            </div>
          ))}

          <label className="field">
            <span className="lbl">
              Internal follow-ups (optional &middot; never blocks publishing)
            </span>
            <textarea
              name="needs"
              defaultValue={(verification?.needs ?? []).join("\n")}
              placeholder="One private reminder per line."
            />
          </label>
        </fieldset>
      </details>

      <fieldset>
        <legend>3. Preview and go live</legend>
        <p className="rail-note">
          Saving keeps this as a draft. <strong>Go live</strong> is the explicit
          publishing decision and puts the clip on Watch without a code push.
        </p>
        <PublishGuard
          workflowAction={publicationAction}
          submitLabel={publicationLabel}
          submitAction={publicationSubmitAction}
          profileComplete={profileComplete}
        />
      </fieldset>

      {hasVotes ? (
        <div className="guard clear">
          <span className="lbl">Card locked after its first vote</span>
          <p>
            The clip, wording and score history now stay immutable. Use the
            status controls above to take this unchanged card offline or put it
            back live through the preview check.
          </p>
        </div>
      ) : (
        <div className="admin-submit">
          <div>
            <button
              className={entryIsLive ? "btn warning" : "btn ghost"}
              type="submit"
              formNoValidate
            >
              {entryIsLive ? "Save draft & take offline" : "Save draft"}
            </button>
            <span className="admin-submit-note">
              Drafts never appear on Watch and cannot receive votes.
            </span>
          </div>
        </div>
      )}

    </form>
  );
}
