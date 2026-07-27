import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Committee Room",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/entries", label: "Entries" },
  { href: "/admin/entries/new", label: "Add entry" },
  { href: "/admin/hall", label: "Hall of Fame" },
  { href: "/admin/people", label: "Representatives" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/", label: "↗ View site" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap admin">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">The Committee Room</h1>
          <p className="lbl">Everything on the board is editable here. Everything you change is logged.</p>
        </div>
        <span className="stamp green">Authenticated admin</span>
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
          The Committee Room is fail-closed unless <code>ADMIN_PASSWORD</code> is configured. Passwordless
          local access requires an explicit <code>ALLOW_INSECURE_ADMIN=true</code> opt-in and is never
          accepted in production.
        </p>
      </footer>
    </div>
  );
}
