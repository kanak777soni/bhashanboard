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
        <span className="stamp green">Local admin</span>
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
          <strong>Edits write straight to the corpus files in <code>data/</code>.</strong> That means every
          change you make here is an ordinary git diff you can read, review and revert before it goes
          anywhere. Run <code>git diff data/</code> to see what you have changed.
        </p>
        <p>
          There is no authentication on this dashboard. It is safe on your own machine and must not be
          deployed to a public URL as it stands.
        </p>
      </footer>
    </div>
  );
}
