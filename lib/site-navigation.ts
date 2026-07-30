export type SiteNavigationLink = {
  href: string;
  label: string;
  emphasis?: boolean;
  /** Additional route prefixes represented by this navigation destination. */
  activePrefixes?: string[];
};

export const PRIMARY_SITE_LINKS: SiteNavigationLink[] = [
  {
    href: "/watch",
    label: "Watch",
    activePrefixes: ["/statement"],
  },
  { href: "/standings", label: "Standings" },
  { href: "/hall", label: "Hall of Fame" },
  {
    href: "/netas",
    label: "Netas",
    activePrefixes: ["/neta"],
  },
  { href: "/submit", label: "Submit" },
];

export const ARCHIVE_SITE_LINKS: SiteNavigationLink[] = [
  { href: "/duel", label: "Aamne-Saamne" },
  {
    href: "/record",
    label: "The Record",
    activePrefixes: ["/category", "/party"],
  },
  { href: "/rejected", label: "Refused" },
  { href: "/rules", label: "Rules" },
];

export function isSiteNavigationLinkActive(
  pathname: string,
  link: SiteNavigationLink,
): boolean {
  const prefixes = [link.href, ...(link.activePrefixes ?? [])];
  return prefixes.some((prefix) =>
    prefix === "/"
      ? pathname === "/"
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function resolveAccountNavigation({
  authenticated,
  role,
}: {
  authenticated: boolean;
  role?: string | null;
}): SiteNavigationLink[] {
  if (!authenticated) {
    return [
      { href: "/sign-in", label: "Sign in" },
      {
        href: "/sign-up",
        label: "Create account",
        emphasis: true,
      },
    ];
  }

  const links: SiteNavigationLink[] = [
    { href: "/account", label: "Account" },
  ];
  const roles = (role ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (roles.includes("admin")) {
    links.push({ href: "/admin", label: "Admin" });
  }

  return links;
}
