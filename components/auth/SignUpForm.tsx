"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignUpForm({ callbackURL }: { callbackURL: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");
    const newsletterOptIn = form.get("newsletter") === "on";
    const termsAccepted = form.get("terms") === "on";

    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }
    if (!termsAccepted) {
      setError("Accept the Terms of use and Privacy notice to register.");
      return;
    }

    setPending(true);
    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL,
        newsletterOptIn,
        termsAccepted,
      });
      if (result.error) {
        setError(
          "Registration could not be completed. If this address is already registered, sign in or reset its password."
        );
        return;
      }
      window.location.assign(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch {
      setError("The Board could not be reached. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <fieldset>
        <legend>Registration</legend>
        <label className="field">
          <span className="lbl">Display name</span>
          <input name="name" autoComplete="name" minLength={2} maxLength={80} required />
        </label>
        <label className="field">
          <span className="lbl">Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span className="lbl">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required
          />
          <span className="rail-note">At least 10 characters.</span>
        </label>
        <label className="field">
          <span className="lbl">Confirm password</span>
          <input
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required
          />
        </label>
        <div className="field checkbox">
          <input id="signup-newsletter" name="newsletter" type="checkbox" />
          <span>
            <label htmlFor="signup-newsletter">Send me occasional Bhashan Board updates.</label>{" "}
            This is optional, described in the <Link href="/privacy">Privacy notice</Link>, and can
            be changed later.
          </span>
        </div>
        <div className="field checkbox">
          <input id="signup-terms" name="terms" type="checkbox" required />
          <span>
            <label htmlFor="signup-terms">I have read and accept the </label>
            <Link href="/terms">Terms of use</Link> and{" "}
            <Link href="/privacy">Privacy notice</Link>.
          </span>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="erratum" style={{ marginBottom: 14 }}>
          {error}
        </p>
      )}
      <button className="btn seal" type="submit" disabled={pending}>
        {pending ? "Entering the register…" : "Register"}
      </button>
    </form>
  );
}
