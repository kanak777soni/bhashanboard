"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInForm({ callbackURL }: { callbackURL: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await authClient.signIn.email({
        email: String(form.get("email") ?? "").trim().toLowerCase(),
        password: String(form.get("password") ?? ""),
        rememberMe: form.get("remember") === "on",
        callbackURL,
      });
      if (result.error) {
        setError(
          result.error.code === "BANNED_USER"
            ? "This account is currently restricted. Contact support if you believe this is an error."
            : "Those credentials were not accepted, or the email is not yet verified."
        );
        return;
      }
      window.location.assign(callbackURL);
    } catch {
      setError("The Board could not be reached. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <fieldset>
        <legend>Credentials</legend>
        <label className="field">
          <span className="lbl">Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span className="lbl">Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <label className="field checkbox">
          <input name="remember" type="checkbox" defaultChecked />
          <span>Keep this device signed in</span>
        </label>
      </fieldset>
      {error && (
        <div role="alert" className="erratum" style={{ marginBottom: 14 }}>
          <p>{error}</p>
          <p style={{ marginTop: 6 }}>
            Not verified yet? <Link href="/verify-email">Resend the verification message.</Link>
          </p>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button className="btn seal" type="submit" disabled={pending}>
          {pending ? "Opening the room…" : "Sign in"}
        </button>
        <Link href="/forgot-password" className="token-reset">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
