"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { useSession } from "@/lib/auth-client";
import {
  PRIMARY_SITE_LINKS,
  resolveAccountNavigation,
  type SiteNavigationLink,
} from "@/lib/site-navigation";

export default function SiteNav() {
  const path = usePathname();
  const { data: session, isPending } = useSession();
  const mobileSectionsRef = useRef<HTMLDetailsElement>(null);
  const accountLinks = resolveAccountNavigation({
    authenticated: Boolean(session),
    role: session?.user.role,
  });

  function renderLink(
    link: SiteNavigationLink,
    onNavigate?: () => void,
    compactLabel = false,
  ) {
    const active =
      link.href === "/" ? path === "/" : path.startsWith(link.href);

    return (
      <Link
        key={link.href}
        href={link.href}
        className={link.emphasis ? "nav-register" : undefined}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
      >
        {compactLabel && link.href === "/sign-up" ? "Join" : link.label}
      </Link>
    );
  }

  function closeMobileSections() {
    mobileSectionsRef.current?.removeAttribute("open");
  }

  return (
    <nav className="site-nav" aria-label="Site navigation">
      <div className="nav nav-desktop">
        {PRIMARY_SITE_LINKS.map((link) => renderLink(link))}
        <div className="nav-auth" role="group" aria-label="Account access">
          {isPending ? (
            <span className="nav-auth-pending" aria-hidden="true" />
          ) : (
            accountLinks.map((link) => renderLink(link))
          )}
        </div>
      </div>

      <div className="nav-mobile">
        <details className="nav-mobile-sections" ref={mobileSectionsRef}>
          <summary className="nav-mobile-summary">Sections</summary>
          <div
            className="nav-mobile-menu"
            role="group"
            aria-label="Site sections"
          >
            {PRIMARY_SITE_LINKS.map((link) =>
              renderLink(link, closeMobileSections),
            )}
          </div>
        </details>

        <div
          className="nav-mobile-auth"
          role="group"
          aria-label="Account access"
        >
          {isPending ? (
            <span className="nav-auth-pending" aria-hidden="true" />
          ) : (
            accountLinks.map((link) =>
              renderLink(link, undefined, true),
            )
          )}
        </div>
      </div>
    </nav>
  );
}
