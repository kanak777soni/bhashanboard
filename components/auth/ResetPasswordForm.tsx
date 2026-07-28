"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordForm({ token }: { token?: string }) {
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("password_confirmation") ?? "")) {
      setError("The two passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message || "This reset link is invalid or has expired.");
        return;
      }
      setComplete(true);
    } catch {
      setError("The password could not be reset. Please request a new link.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="erratum">
        <p>This reset link has no token. <Link href="/forgot-password">Request a new one.</Link></p>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="committee-note" role="status">
        <span className="lbl">Key replaced</span>
        <p>Your password has been changed. <Link href="/sign-in">Sign in with the new password.</Link></p>
      </div>
    );
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <fieldset>
        <legend>New password</legend>
        <label className="field">
          <span className="lbl">Password</span>
          <input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required />
        </label>
        <label className="field">
          <span className="lbl">Confirm password</span>
          <input name="password_confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={128} required />
        </label>
      </fieldset>
      {error && <p role="alert" className="erratum" style={{ marginBottom: 14 }}>{error}</p>}
      <button className="btn seal" type="submit" disabled={pending}>
        {pending ? "Replacing key…" : "Set new password"}
      </button>
    </form>
  );
}
