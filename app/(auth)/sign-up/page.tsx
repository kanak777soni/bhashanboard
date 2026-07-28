import type { Metadata } from "next";
import AuthPanel from "@/components/auth/AuthPanel";
import SignUpForm from "@/components/auth/SignUpForm";
import { safeAuthReturnPath } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "Register" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const callbackURL = safeAuthReturnPath((await searchParams).callbackURL);
  return (
    <AuthPanel
      eyebrow="Join the Committee"
      title="Take a seat"
      introduction="Create one verified account. It will hold your viewing receipts and one final ruling per statement."
      alternate={{ href: `/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`, label: "Sign in", prompt: "Already registered?" }}
    >
      <SignUpForm callbackURL={callbackURL} />
    </AuthPanel>
  );
}
