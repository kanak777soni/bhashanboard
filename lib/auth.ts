import "server-only";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";
import {
  authConfigurationIssues,
  authSecretIsAcceptable,
  resolvedAuthSiteUrl,
} from "./auth-config";
import {
  safeBrevoError,
  sendPasswordResetMessage,
  sendVerificationMessage,
  sendWelcomeMessage,
  transactionalMailIsReady,
} from "./brevo";

const BUILD_SAFE_DATABASE_URL =
  "postgresql://configuration-missing:configuration-missing@127.0.0.1:1/configuration-missing";
const BUILD_SAFE_SECRET =
  "build-only-placeholder-that-is-never-accepted-by-the-auth-route";

function configuredSiteUrl(): string {
  return resolvedAuthSiteUrl();
}

function configuredTrustedOrigins(): string[] {
  const origins = new Set([configuredSiteUrl()]);
  for (const candidate of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    const host = candidate?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (host) origins.add(`https://${host}`);
  }
  return [...origins];
}

function databaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || BUILD_SAFE_DATABASE_URL;
}

declare global {
  // eslint-disable-next-line no-var
  var bhashanAuthPool: Pool | undefined;
}

export const authPool =
  globalThis.bhashanAuthPool ??
  new Pool({
    connectionString: databaseUrl(),
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });

if (process.env.NODE_ENV !== "production") globalThis.bhashanAuthPool = authPool;

function newsletterValue(user: Record<string, unknown>): boolean {
  return user.newsletterOptIn === true;
}

function acceptedTerms(user: Record<string, unknown>): boolean {
  return user.termsAccepted === true;
}

export class AuthConfigurationError extends Error {
  readonly status = 503;

  constructor(readonly missing: string[]) {
    super(`Authentication is unavailable because configuration is missing: ${missing.join(", ")}.`);
    this.name = "AuthConfigurationError";
  }
}

export function assertAuthConfigured(): void {
  const issues = authConfigurationIssues();
  if (issues.length) throw new AuthConfigurationError(issues);
}

const adminPlugin = admin({
  defaultRole: "user",
  adminRoles: ["admin"],
  bannedUserMessage: "This Committee account is not permitted to sign in.",
});

export const authOptions = {
  appName: "The Bhashan Board",
  baseURL: configuredSiteUrl(),
  basePath: "/api/auth",
  secret: authSecretIsAcceptable(process.env.BETTER_AUTH_SECRET)
    ? process.env.BETTER_AUTH_SECRET!.trim()
    : BUILD_SAFE_SECRET,
  database: authPool,
  trustedOrigins: configuredTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    // A password reset is an account-recovery event. Any session copied from
    // the compromised device must stop working as soon as the key changes.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetMessage({ email: user.email, name: user.name, url });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationMessage({ email: user.email, name: user.name, url });
    },
    afterEmailVerification: async (user) => {
      try {
        await sendWelcomeMessage({
          email: user.email,
          name: user.name,
          siteUrl: configuredSiteUrl(),
        });
      } catch (error) {
        // Verification has already succeeded. A welcome-email outage must not
        // make the verification link appear unsuccessful.
        console.error("Welcome email failed:", safeBrevoError(error));
      }
    },
  },
  user: {
    modelName: "auth_user",
    additionalFields: {
      newsletterOptIn: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: true,
      },
      newsletterOptInAt: {
        type: "date",
        required: false,
        input: false,
      },
      anonymizedAt: {
        type: "date",
        required: false,
        input: false,
      },
      termsAccepted: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: true,
      },
      termsAcceptedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  session: {
    modelName: "auth_session",
  },
  account: {
    modelName: "auth_account",
  },
  verification: {
    modelName: "auth_verification",
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const optedIn = newsletterValue(user);
          if (!acceptedTerms(user)) {
            throw new Error("The Terms of use and Privacy notice must be accepted.");
          }
          return {
            data: {
              ...user,
              newsletterOptIn: optedIn,
              newsletterOptInAt: optedIn ? new Date() : null,
              termsAccepted: true,
              termsAcceptedAt: new Date(),
            },
          };
        },
      },
      update: {
        before: async (user) => {
          if (!Object.hasOwn(user, "newsletterOptIn")) return;
          const optedIn = newsletterValue(user);
          return {
            data: {
              ...user,
              newsletterOptIn: optedIn,
              newsletterOptInAt: optedIn ? new Date() : null,
            },
          };
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "auth_rate_limit",
    fields: {
      key: "key",
      count: "count",
      lastRequest: "last_request",
    },
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/request-password-reset": { window: 60 * 10, max: 5 },
      "/send-verification-email": { window: 60 * 10, max: 5 },
    },
  },
  plugins: [adminPlugin],
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

export type Auth = typeof auth;

export { authConfigurationIssues, transactionalMailIsReady };
