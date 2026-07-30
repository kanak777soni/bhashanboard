import assert from "node:assert/strict";
import test from "node:test";
import {
  ARCHIVE_SITE_LINKS,
  PRIMARY_SITE_LINKS,
  isSiteNavigationLinkActive,
  resolveAccountNavigation,
} from "../lib/site-navigation";

test("primary navigation leads with the public watch journey", () => {
  assert.deepEqual(
    PRIMARY_SITE_LINKS.map(({ href, label }) => ({ href, label })),
    [
      { href: "/watch", label: "Watch" },
      { href: "/standings", label: "Standings" },
      { href: "/hall", label: "Hall of Fame" },
      { href: "/netas", label: "Netas" },
      { href: "/submit", label: "Submit" },
    ],
  );
});

test("secondary institutional pages stay available under archive and more", () => {
  assert.deepEqual(ARCHIVE_SITE_LINKS, [
    { href: "/duel", label: "Aamne-Saamne" },
    {
      href: "/record",
      label: "The Record",
      activePrefixes: ["/category", "/party"],
    },
    { href: "/rejected", label: "Refused" },
    { href: "/rules", label: "Rules" },
  ]);
});

test("navigation destinations own their related detail routes without partial matches", () => {
  const watch = PRIMARY_SITE_LINKS.find((link) => link.href === "/watch")!;
  const record = ARCHIVE_SITE_LINKS.find((link) => link.href === "/record")!;
  const netas = PRIMARY_SITE_LINKS.find((link) => link.href === "/netas")!;

  assert.equal(isSiteNavigationLinkActive("/statement/example", watch), true);
  assert.equal(isSiteNavigationLinkActive("/party/BJP", record), true);
  assert.equal(isSiteNavigationLinkActive("/neta/example", netas), true);
  assert.equal(isSiteNavigationLinkActive("/netas", netas), true);
  assert.equal(isSiteNavigationLinkActive("/netas-copy", netas), false);
});

test("guest navigation exposes both authentication entry points", () => {
  assert.deepEqual(
    resolveAccountNavigation({ authenticated: false }),
    [
      { href: "/sign-in", label: "Sign in" },
      {
        href: "/sign-up",
        label: "Create account",
        emphasis: true,
      },
    ]
  );
});

test("signed-in navigation replaces guest actions with the account", () => {
  assert.deepEqual(
    resolveAccountNavigation({
      authenticated: true,
      role: "user",
    }),
    [{ href: "/account", label: "Account" }]
  );
});

test("admin navigation includes account and administration links", () => {
  assert.deepEqual(
    resolveAccountNavigation({
      authenticated: true,
      role: "user, admin",
    }),
    [
      { href: "/account", label: "Account" },
      { href: "/admin", label: "Admin" },
    ]
  );
});

test("admin navigation normalizes role casing like the server guard", () => {
  assert.deepEqual(
    resolveAccountNavigation({
      authenticated: true,
      role: "user, Admin",
    }),
    [
      { href: "/account", label: "Account" },
      { href: "/admin", label: "Admin" },
    ]
  );
});

test("an unauthenticated role value never reveals privileged navigation", () => {
  assert.deepEqual(
    resolveAccountNavigation({
      authenticated: false,
      role: "admin",
    }),
    [
      { href: "/sign-in", label: "Sign in" },
      {
        href: "/sign-up",
        label: "Create account",
        emphasis: true,
      },
    ]
  );
});
