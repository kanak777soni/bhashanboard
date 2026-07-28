import type { Metadata } from "next";
import AuthPanel from "@/components/auth/AuthPanel";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthPanel
      eyebrow="Account recovery"
      title="Request a new key"
      introduction="Enter your account email. For privacy, the response is the same whether or not the address is registered."
      alternate={{ href: "/sign-in", label: "Return to sign in", prompt: "Remembered it?" }}
    >
      <ForgotPasswordForm />
    </AuthPanel>
  );
}
