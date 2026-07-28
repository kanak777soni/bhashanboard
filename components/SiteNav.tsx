"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  PRIMARY_SITE_LINKS,
  resolveAccountNavigation,
  type SiteNavigationLink,
} from "@/lib/site-navigation";

export default function SiteNav() {
  const path = usePathname();
  const { data: session } = useSession();
  const accountLinks = resolveAccountNavigation({
    authenticated: Boolean(session),
    role: session?.user.role,
  });

  function renderLink(link: SiteNavigationLink) {
    const active =
      link.href === "/" ? path === "/" : path.startsWith(link.href);

    return (
      <Link
        key={link.href}
        href={link.href}
        className={link.emphasis ? "nav-register" : undefined}
        aria-current={active ? "page" : undefined}
      >
        {link.label}
      </Link>
    );
  }

  return (
    <nav className="nav" aria-label="Site navigation">
      {PRIMARY_SITE_LINKS.map(renderLink)}
      <div className="nav-auth" role="group" aria-label="Account access">
        {accountLinks.map(renderLink)}
      </div>
    </nav>
  );
}
