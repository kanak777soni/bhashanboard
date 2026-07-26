"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "The Standings" },
  { href: "/duel", label: "Duel" },
  { href: "/netas", label: "Netas" },
  { href: "/hall", label: "Hall of Fame" },
  { href: "/ledger", label: "Ledger" },
  { href: "/rules", label: "Rules" },
  { href: "/submit", label: "Submit" },
];

export default function SiteNav() {
  const path = usePathname();

  return (
    <nav className="nav" aria-label="Sections">
      {LINKS.map((l) => {
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
