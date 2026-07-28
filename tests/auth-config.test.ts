import assert from "node:assert/strict";
import test from "node:test";
import {
  authConfigurationIssues,
  authSecretIsAcceptable,
  canonicalAuthSiteUrl,
} from "../lib/auth-config";

test("authentication rejects short and placeholder secrets", () => {
  assert.equal(authSecretIsAcceptable("short"), false);
  assert.equal(
    authSecretIsAcceptable("replace-with-a-long-random-secret"),
    false
  );
  assert.equal(authSecretIsAcceptable("x".repeat(64)), false);
  assert.equal(
    authSecretIsAcceptable("zT7!qL2#vN9@rP4$kM8^sD5&wH3*cF6+"),
    true
  );
});

test("production auth callbacks require a clean HTTPS origin", () => {
  assert.equal(
    canonicalAuthSiteUrl({
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://bhashanboard.example/",
    }),
    "https://bhashanboard.example"
  );
  assert.equal(
    canonicalAuthSiteUrl({
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "http://bhashanboard.example",
    }),
    undefined
  );
  assert.equal(
    canonicalAuthSiteUrl({
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://bhashanboard.example/path",
    }),
    undefined
  );
  assert.equal(
    canonicalAuthSiteUrl({
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    }),
    "http://localhost:3000"
  );
});

test("configuration reports unsafe deployment values without echoing them", () => {
  assert.deepEqual(
    authConfigurationIssues({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://configured",
      BETTER_AUTH_SECRET: "not-long-enough",
      NEXT_PUBLIC_SITE_URL: "http://public.example",
    }),
    [
      "BETTER_AUTH_SECRET (32+ random bytes)",
      "a valid HTTPS NEXT_PUBLIC_SITE_URL",
    ]
  );
});

test("production validates the public and auth origins independently", () => {
  const base = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://configured",
    BETTER_AUTH_SECRET: "zT7!qL2#vN9@rP4$kM8^sD5&wH3*cF6+",
  };
  assert.deepEqual(
    authConfigurationIssues({
      ...base,
      BETTER_AUTH_URL: "https://auth.example",
      NEXT_PUBLIC_SITE_URL: "not-a-url",
    }),
    ["a valid HTTPS NEXT_PUBLIC_SITE_URL"]
  );
  assert.deepEqual(
    authConfigurationIssues({
      ...base,
      BETTER_AUTH_URL: "https://auth.example",
      NEXT_PUBLIC_SITE_URL: "https://site.example",
    }),
    ["matching BETTER_AUTH_URL and NEXT_PUBLIC_SITE_URL origins"]
  );
  assert.deepEqual(
    authConfigurationIssues({
      ...base,
      BETTER_AUTH_URL: "https://site.example",
    }),
    ["NEXT_PUBLIC_SITE_URL"]
  );
});
