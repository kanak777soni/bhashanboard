"use client";

import { useRef, useState, type FormEvent } from "react";

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; reference: string };

export default function SubmissionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [state, setState] = useState<FormState>({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setState({ kind: "submitting" });
    const form = new FormData(event.currentTarget);
    const payload = {
      sourceUrl: form.get("sourceUrl"),
      startTimestamp: form.get("startTimestamp"),
      endTimestamp: form.get("endTimestamp"),
      speaker: form.get("speaker"),
      eventContext: form.get("eventContext"),
      claim: form.get("claim"),
      originalLanguage: form.get("originalLanguage"),
      submitterName: form.get("submitterName"),
      contactEmail: form.get("contactEmail"),
      syntheticDeclaration: form.get("syntheticDeclaration") === "on",
      website: form.get("website"),
    };

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        reference?: string;
      };
      if (!response.ok || !result.ok || !result.reference) {
        setState({
          kind: "error",
          message:
            result.message ??
            "The clip could not be sent. Check the form and try again.",
        });
        return;
      }
      formRef.current?.reset();
      setState({ kind: "success", reference: result.reference });
    } catch {
      setState({
        kind: "error",
        message:
          "The Board could not be reached. Check your connection and try again.",
      });
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <form
      ref={formRef}
      className="submission-form"
      onSubmit={submit}
      aria-busy={state.kind === "submitting"}
    >
      <fieldset disabled={state.kind === "submitting"}>
        <legend>1 · Send the clip</legend>
        <label className="field">
          <span className="lbl">Video or post URL</span>
          <input
            name="sourceUrl"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="YouTube, Facebook, Instagram, official feed, or news source"
            maxLength={2048}
            required
          />
          <small>
            Facebook and Instagram links are accepted. YouTube and direct
            video sources are usually easiest to play on the Board.
          </small>
        </label>
        <div className="submit-timestamps">
          <label className="field">
            <span className="lbl">Start timestamp · optional</span>
            <input
              name="startTimestamp"
              placeholder="00:41"
              inputMode="numeric"
              maxLength={12}
              pattern="\d{1,3}(?::[0-5]\d){0,2}"
            />
          </label>
          <label className="field">
            <span className="lbl">End timestamp · optional</span>
            <input
              name="endTimestamp"
              placeholder="01:03"
              inputMode="numeric"
              maxLength={12}
              pattern="\d{1,3}(?::[0-5]\d){0,2}"
            />
          </label>
        </div>
        <p className="rail-note">
          Supply both timestamps or neither. The excerpt must run from three
          seconds to three minutes.
        </p>
      </fieldset>

      <fieldset disabled={state.kind === "submitting"}>
        <legend>2 · Tell us what we are watching</legend>
        <label className="field">
          <span className="lbl">Who said it</span>
          <input
            name="speaker"
            placeholder="Name and office"
            minLength={2}
            maxLength={160}
            required
          />
        </label>
        <label className="field">
          <span className="lbl">Where and when · optional</span>
          <input
            name="eventContext"
            placeholder="Venue, city, date, programme, or speech"
            maxLength={500}
          />
        </label>
        <label className="field">
          <span className="lbl">Why it belongs on the Board</span>
          <textarea
            name="claim"
            placeholder="What was said, and what makes the moment worth watching?"
            minLength={10}
            maxLength={1200}
            required
          />
        </label>
        <label className="field">
          <span className="lbl">Language of the original</span>
          <input
            name="originalLanguage"
            placeholder="Hindi, Tamil, Bengali…"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
      </fieldset>

      <fieldset disabled={state.kind === "submitting"}>
        <legend>3 · Contact and declaration</legend>
        <div className="submit-timestamps">
          <label className="field">
            <span className="lbl">Your name · optional</span>
            <input
              name="submitterName"
              autoComplete="name"
              maxLength={120}
            />
          </label>
          <label className="field">
            <span className="lbl">Email for acknowledgement</span>
            <input
              name="contactEmail"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
        </div>
        <label className="submission-declaration">
          <input name="syntheticDeclaration" type="checkbox" required />
          <span>
            I declare this is not AI-generated, dubbed, re-enacted, or edited
            in a way that changes its meaning.
          </span>
        </label>
        <label
          aria-hidden="true"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clipPath: "inset(50%)",
          }}
        >
          Website
          <input
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </fieldset>

      <div className="submission-action">
        <button
          type="submit"
          className="btn seal"
          disabled={state.kind === "submitting"}
        >
          {state.kind === "submitting"
            ? "Sending clip…"
            : "Send to the Board"}
        </button>
        <p className="rail-note">
          Nothing goes live automatically. A submission lands backstage for an
          admin to open and publish.
        </p>
      </div>
      <div className="submission-response" aria-live="polite">
        {state.kind === "error" && (
          <p className="submission-error" role="alert">
            {state.message}
          </p>
        )}
        {state.kind === "success" && (
          <div className="submission-success">
            <span className="stamp green">Clip received</span>
            <p>
              Keep reference <strong>{state.reference}</strong>. We will take
              it from here.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
