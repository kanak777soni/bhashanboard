"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";

const LINKS = [
  { href: "/", label: "The Standings" },
  { href: "/duel", label: "Aamne-Saamne" },
  { href: "/netas", label: "Netas" },
  { href: "/hall", label: "Hall of Fame" },
  { href: "/ledger", label: "Ledger" },
  { href: "/rejected", label: "Refused" },
  { href: "/rules", label: "Rules" },
  { href: "/submit", label: "Submit" },
];

export default function SiteNav() {
  const path = usePathname();
  const { data: session } = useSession();
  const roles = (session?.user.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const accountLink = session
    ? { href: "/account", label: "Account" }
    : { href: "/sign-in", label: "Sign in" };
  const links = roles.includes("admin")
    ? [...LINKS, accountLink, { href: "/admin", label: "Admin" }]
    : [...LINKS, accountLink];

  return (
    <nav className="nav" aria-label="Sections">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
