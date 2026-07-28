import type { Metadata } from "next";
import AuthPanel from "@/components/auth/AuthPanel";
import VerifyEmailForm from "@/components/auth/VerifyEmailForm";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthPanel
      eyebrow="One final formality"
      title="Check your inbox"
      introduction="Open the verification link sent by the Registrar. You cannot sign in or vote until the address is confirmed."
      alternate={{ href: "/sign-in", label: "Go to sign in", prompt: "Already verified?" }}
    >
      <VerifyEmailForm initialEmail={email} />
    </AuthPanel>
  );
}
