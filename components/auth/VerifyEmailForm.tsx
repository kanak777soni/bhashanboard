"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function VerifyEmailForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email: String(form.get("email") ?? "").trim().toLowerCase(),
        callbackURL: "/account",
      });
      if (result.error) {
        setError("The verification request could not be completed. Please wait a moment and retry.");
        return;
      }
      setMessage("If the address is registered and unverified, a fresh link is on its way.");
    } catch {
      setError("The verification service could not be reached. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <fieldset>
        <legend>Resend verification</legend>
        <label className="field">
          <span className="lbl">Email</span>
          <input name="email" type="email" autoComplete="email" defaultValue={initialEmail} required />
        </label>
      </fieldset>
      {message && <p role="status" className="committee-note" style={{ marginBottom: 14 }}>{message}</p>}
      {error && <p role="alert" className="erratum" style={{ marginBottom: 14 }}>{error}</p>}
      <button className="btn seal" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Resend verification"}
      </button>
    </form>
  );
}
