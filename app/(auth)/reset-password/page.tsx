import type { Metadata } from "next";
import AuthPanel from "@/components/auth/AuthPanel";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthPanel
      eyebrow="Account recovery"
      title="Replace your key"
      introduction="Choose a new password. A reset link expires after one hour and can be used only once."
    >
      <ResetPasswordForm token={token} />
    </AuthPanel>
  );
}
