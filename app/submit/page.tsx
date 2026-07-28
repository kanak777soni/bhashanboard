import type { Metadata } from "next";
import SiteFrame from "@/components/SiteFrame";

export const metadata: Metadata = {
  title: "Submit an entry",
  description: "Submit a sourced, verbatim statement for review by the Committee.",
};

export default function SubmitPage() {
  return (
    <SiteFrame>
      <div className="document">
        <h1 className="page-title">Submit an entry</h1>
        <p style={{ color: "var(--ink-70)" }}>
          No team can watch two hundred channels in twelve languages. Readers can. Every published entry
          credits the reader who sourced it.
        </p>

        <div className="erratum" style={{ marginTop: 24 }}>
          <span className="lbl">Before you submit</span>
          <p>
            The source must be a primary feed or a broadcast upload — an official channel, an assembly
            feed, a press bureau, or a recognised news network. Re-uploads with no attribution cannot be
            published, though they are useful as a lead. Never screen-record and re-host a clip: we embed,
            we do not host.
          </p>
        </div>

        {/* Wiring: this posts to a moderation queue. Nothing auto-publishes —
            automated detection proposes, humans dispose (docs/03 §3.3). */}
        <form style={{ display: "grid", gap: 18, marginTop: 26 }}>
          <label className="field">
            <span className="lbl">Source URL</span>
            <input type="url" placeholder="Link to the original upload" required />
          </label>

          <div className="submit-timestamps">
            <label className="field">
              <span className="lbl">Start timestamp</span>
              <input type="text" placeholder="00:41" inputMode="numeric" />
            </label>
            <label className="field">
              <span className="lbl">End timestamp</span>
              <input type="text" placeholder="01:03" inputMode="numeric" />
            </label>
          </div>

          <label className="field">
            <span className="lbl">Who said it</span>
            <input type="text" placeholder="Name and office" />
          </label>

          <label className="field">
            <span className="lbl">Where and when</span>
            <input type="text" placeholder="Venue, city, date" />
          </label>

          <label className="field">
            <span className="lbl">What was claimed &mdash; one line, neutrally worded</span>
            <textarea placeholder="State what was asserted. Not a verdict on the person." />
          </label>

          <label className="field">
            <span className="lbl">Language of the original</span>
            <input type="text" placeholder="Hindi, Tamil, Bengali…" />
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5 }}>
            <input type="checkbox" required style={{ width: "auto", marginTop: 5 }} />
            <span>
              I declare that this clip is <strong>not synthetically generated</strong> — not AI-generated,
              dubbed, re-enacted, or edited in a way that changes its sense. Submissions are additionally
              checked automatically.
            </span>
          </label>

          <div>
            <button type="submit" className="btn seal">
              Submit for review
            </button>
          </div>
        </form>

        <p style={{ fontSize: 13.5, color: "var(--ink-45)", marginTop: 20 }}>
          Submissions enter a moderation queue. Nothing is published automatically. Roughly a third are
          rejected — most often because the surrounding context changes what the clip appears to say.
        </p>
      </div>
    </SiteFrame>
  );
}
