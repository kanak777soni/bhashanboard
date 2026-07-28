export type SiteNavigationLink = {
  href: string;
  label: string;
  emphasis?: boolean;
};

export const PRIMARY_SITE_LINKS: SiteNavigationLink[] = [
  { href: "/", label: "The Standings" },
  { href: "/duel", label: "Aamne-Saamne" },
  { href: "/netas", label: "Netas" },
  { href: "/hall", label: "Hall of Fame" },
  { href: "/ledger", label: "Ledger" },
  { href: "/rejected", label: "Refused" },
  { href: "/rules", label: "Rules" },
  { href: "/submit", label: "Submit" },
];

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
