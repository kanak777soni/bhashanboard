import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteFrame from "@/components/SiteFrame";
import { AuthGuardError, requireUser } from "@/lib/auth-guards";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireUser();
  } catch (error) {
    if (error instanceof AuthGuardError) {
      if (error.code === "ACCOUNT_BANNED") {
        redirect("/sign-in?status=account-restricted");
      }
      redirect(`/sign-in?callbackURL=${encodeURIComponent("/account")}`);
    }
    throw error;
  }

  return (
    <SiteFrame>
      <nav className="admin-nav" aria-label="Account sections" style={{ marginTop: 24 }}>
        <Link href="/account">Account</Link>
        <Link href="/account/votes">Your rulings</Link>
      </nav>
      {children}
    </SiteFrame>
  );
}
