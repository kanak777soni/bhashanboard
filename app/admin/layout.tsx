import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthGuardError } from "@/lib/auth-guards";
import { requireAdmin } from "@/lib/require-admin";

export const metadata: Metadata = {
  title: "Board Desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/entries", label: "Entries" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/entries/new", label: "Add entry" },
  { href: "/admin/hall", label: "Hall of Fame" },
  { href: "/admin/people", label: "Representatives" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/ledger", label: "Ledger" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/", label: "↗ View site" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let actor: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    actor = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthGuardError) {
      if (error.code === "ADMIN_REQUIRED") {
        redirect("/account?notice=admin-required");
      }
      if (error.code === "EMAIL_NOT_VERIFIED") {
        redirect("/verify-email");
      }
      if (error.code === "ACCOUNT_BANNED") {
        redirect("/sign-in?status=account-restricted");
      }
      redirect(`/sign-in?callbackURL=${encodeURIComponent("/admin")}`);
    }
    throw error;
  }

  return (
    <div className="wrap admin">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Board Desk</h1>
          <p className="lbl">Everything on the board is editable here. Everything you change is logged.</p>
        </div>
        <span className="stamp green">{actor.displayLabel}</span>
      </header>

      <nav className="admin-nav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      {children}

      <footer className="site">
        <p>
          <strong>Edits are committed to the corpus database.</strong> Each mutation and its audit event are
          one transaction: if the record cannot be logged, the record is not changed.
        </p>
        <p>
          Every route, sensitive read and mutation validates a registered administrator session on
          the server. The first administrator is promoted once through the local database command;
          there is no shared browser password or network-facing bootstrap endpoint.
        </p>
      </footer>
    </div>
  );
}
