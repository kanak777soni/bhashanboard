"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function AccountControls({ newsletterOptIn }: { newsletterOptIn: boolean }) {
  const [subscribed, setSubscribed] = useState(newsletterOptIn);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function updateNewsletter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const next = form.get("newsletter") === "on";
    try {
      const result = await authClient.updateUser({ newsletterOptIn: next });
      if (result.error) {
        setMessage(result.error.message || "The preference could not be saved.");
        return;
      }
      setSubscribed(next);
      setMessage(next ? "Updates are enabled." : "Updates are disabled.");
    } catch {
      setMessage("The preference could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function leave() {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <form className="admin-form" onSubmit={updateNewsletter}>
        <fieldset>
          <legend>Email preference</legend>
          <label className="field checkbox">
            <input key={String(subscribed)} name="newsletter" type="checkbox" defaultChecked={subscribed} />
            <span>Send me occasional Bhashan Board updates.</span>
          </label>
        </fieldset>
        {message && <p role="status" className="rail-note" style={{ marginBottom: 10 }}>{message}</p>}
        <button className="btn" type="submit" disabled={pending}>Save preference</button>
      </form>
      <div>
        <button className="btn seal" type="button" onClick={leave} disabled={pending}>
          Sign out
        </button>
      </div>
    </div>
  );
}
