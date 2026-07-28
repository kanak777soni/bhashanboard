"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordForm() {
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await authClient.requestPasswordReset({
        email: String(form.get("email") ?? "").trim().toLowerCase(),
        redirectTo: "/reset-password",
      });
    } catch {
      // Preserve the same outward response for unknown addresses and transient
      // delivery failures. A user can safely retry after a short interval.
    } finally {
      // The response is deliberately identical for registered and unknown
      // addresses, preventing account discovery through this form.
      setComplete(true);
      setPending(false);
    }
  }

  if (complete) {
    return (
      <div className="committee-note" role="status">
        <span className="lbl">Request entered</span>
        <p>If an account exists for that address, a one-time reset link is on its way.</p>
      </div>
    );
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <fieldset>
        <legend>Account email</legend>
        <label className="field">
          <span className="lbl">Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </fieldset>
      <button className="btn seal" type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Send reset link"}
      </button>
    </form>
  );
}
