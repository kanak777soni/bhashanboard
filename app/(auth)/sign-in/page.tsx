import type { Metadata } from "next";
import AuthPanel from "@/components/auth/AuthPanel";
import SignInForm from "@/components/auth/SignInForm";
import { safeAuthReturnPath } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string; status?: string }>;
}) {
  const params = await searchParams;
  const callbackURL = safeAuthReturnPath(params.callbackURL);
  const accountRestricted = params.status === "account-restricted";
  return (
    <AuthPanel
      eyebrow="Committee access"
      title="Return to your seat"
      introduction={
        accountRestricted
          ? "This account is currently restricted. Contact the Committee if you believe this is an error."
          : "Sign in with the verified address attached to your rulings."
      }
      alternate={{ href: `/sign-up?callbackURL=${encodeURIComponent(callbackURL)}`, label: "Register", prompt: "No account yet?" }}
    >
      <SignInForm callbackURL={callbackURL} />
    </AuthPanel>
  );
}
