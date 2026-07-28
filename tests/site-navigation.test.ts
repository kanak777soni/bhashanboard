import assert from "node:assert/strict";
import test from "node:test";
import { resolveAccountNavigation } from "../lib/site-navigation";

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
