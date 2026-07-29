"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { useSession } from "@/lib/auth-client";
import {
  ARCHIVE_SITE_LINKS,
  PRIMARY_SITE_LINKS,
  isSiteNavigationLinkActive,
  resolveAccountNavigation,
  type SiteNavigationLink,
} from "@/lib/site-navigation";

export default function SiteNav() {
  const path = usePathname();
  const { data: session, isPending } = useSession();
  const mobileSectionsRef = useRef<HTMLDetailsElement>(null);
  const desktopArchiveRef = useRef<HTMLDetailsElement>(null);
  const accountLinks = resolveAccountNavigation({
    authenticated: Boolean(session),
    role: session?.user.role,
  });

  function renderLink(
    link: SiteNavigationLink,
    onNavigate?: () => void,
    compactLabel = false,
  ) {
    const active = isSiteNavigationLinkActive(path, link);

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

  function closeDesktopArchive() {
    desktopArchiveRef.current?.removeAttribute("open");
  }

  const archiveActive = ARCHIVE_SITE_LINKS.some((link) =>
    isSiteNavigationLinkActive(path, link),
  );

  return (
    <nav className="site-nav" aria-label="Site navigation">
      <div className="nav nav-desktop">
        {PRIMARY_SITE_LINKS.map((link) => renderLink(link))}
        <details className="nav-more" ref={desktopArchiveRef}>
          <summary
            className="nav-more-summary"
            aria-current={archiveActive ? "page" : undefined}
          >
            Archive / More
          </summary>
          <div className="nav-more-menu">
            {ARCHIVE_SITE_LINKS.map((link) =>
              renderLink(link, closeDesktopArchive),
            )}
          </div>
        </details>
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
            <span className="nav-mobile-group-label lbl">Main</span>
            {PRIMARY_SITE_LINKS.map((link) =>
              renderLink(link, closeMobileSections),
            )}
            <span className="nav-mobile-group-label lbl">
              Archive / More
            </span>
            {ARCHIVE_SITE_LINKS.map((link) =>
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
