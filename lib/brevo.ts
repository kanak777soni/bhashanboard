import "server-only";

import { mailConfigurationIssues } from "./brevo-config";

const BREVO_API_BASE = "https://api.brevo.com/v3";
const TRANSACTIONAL_TEMPLATE_ENV_NAMES = [
  "BREVO_VERIFY_TEMPLATE_ID",
  "BREVO_RESET_TEMPLATE_ID",
  "BREVO_WELCOME_TEMPLATE_ID",
  "BREVO_SUBMISSION_TEMPLATE_ID",
] as const;

type TemplateKind = "verify" | "reset" | "welcome" | "submission";

interface MessageInput {
  to: string;
  name: string;
  subject: string;
  html: string;
  text: string;
  template: TemplateKind;
  params?: Record<string, string>;
}

interface Recipient {
  email: string;
  name?: string;
}

export class BrevoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrevoConfigurationError";
  }
}

class BrevoRequestError extends Error {
  constructor(readonly status: number) {
    super(`Brevo request failed with status ${status}.`);
    this.name = "BrevoRequestError";
  }
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function positiveInteger(name: string): number | undefined {
  const value = env(name);
  if (!value) return undefined;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new BrevoConfigurationError(`${name} must be a positive integer when configured.`);
  }
  return Number(value);
}

/**
 * Report configuration keys only—never their values—so callers can decide
 * whether an email-dependent auth operation is safe to begin before Better
 * Auth writes a user or verification record.
 */
export function transactionalMailConfigurationIssues(): string[] {
  return mailConfigurationIssues({
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
    BREVO_VERIFY_TEMPLATE_ID: process.env.BREVO_VERIFY_TEMPLATE_ID,
    BREVO_RESET_TEMPLATE_ID: process.env.BREVO_RESET_TEMPLATE_ID,
    BREVO_WELCOME_TEMPLATE_ID: process.env.BREVO_WELCOME_TEMPLATE_ID,
    BREVO_SUBMISSION_TEMPLATE_ID: process.env.BREVO_SUBMISSION_TEMPLATE_ID,
  });
}

export function transactionalMailIsReady(): boolean {
  return transactionalMailConfigurationIssues().length === 0;
}

function templateId(kind: TemplateKind): number | undefined {
  const names: Record<TemplateKind, string> = {
    verify: "BREVO_VERIFY_TEMPLATE_ID",
    reset: "BREVO_RESET_TEMPLATE_ID",
    welcome: "BREVO_WELCOME_TEMPLATE_ID",
    submission: "BREVO_SUBMISSION_TEMPLATE_ID",
  };
  return positiveInteger(names[kind]);
}

function requiredMailConfig() {
  const issues = transactionalMailConfigurationIssues();
  if (issues.length) {
    throw new BrevoConfigurationError(
      `Transactional email configuration is incomplete or invalid: ${issues.join(", ")}.`
    );
  }
  const apiKey = env("BREVO_API_KEY");
  const senderEmail = env("BREVO_SENDER_EMAIL");
  // The readiness check above narrows these values for runtime use.
  if (!apiKey || !senderEmail) throw new BrevoConfigurationError("Transactional email is unavailable.");
  return {
    apiKey,
    sender: {
      email: senderEmail,
      name: env("BREVO_SENDER_NAME") ?? "The Bhashan Board",
    },
  };
}

async function brevoRequest(
  path: string,
  init: RequestInit,
  options: { allowNotFound?: boolean; apiKey?: string } = {}
): Promise<void> {
  const apiKey = options.apiKey ?? env("BREVO_API_KEY");
  if (!apiKey) throw new BrevoConfigurationError("BREVO_API_KEY is not configured.");

  const response = await fetch(`${BREVO_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok && !(options.allowNotFound && response.status === 404)) {
    // Do not include the response body: providers can echo an address or other
    // personal data in validation errors.
    throw new BrevoRequestError(response.status);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function actionEmail({
  heading,
  greeting,
  body,
  action,
  url,
  expires,
}: {
  heading: string;
  greeting: string;
  body: string;
  action: string;
  url: string;
  expires: string;
}): { html: string; text: string } {
  const safeUrl = escapeHtml(url);
  const html = `<!doctype html><html><body style="margin:0;background:#eef0e7;color:#101813;font-family:Georgia,serif"><div style="max-width:620px;margin:0 auto;padding:40px 24px"><p style="font:700 11px/1.4 Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#9d1f31">The Bhashan Board</p><h1 style="font-size:34px;font-weight:400;margin:18px 0">${escapeHtml(heading)}</h1><p>${escapeHtml(greeting)}</p><p style="line-height:1.65">${escapeHtml(body)}</p><p style="margin:30px 0"><a href="${safeUrl}" style="display:inline-block;background:#9d1f31;color:#fff;padding:13px 20px;text-decoration:none;font:700 12px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase">${escapeHtml(action)}</a></p><p style="font-size:13px;line-height:1.55;color:#536158">${escapeHtml(expires)} If the button does not work, copy this address:<br><a href="${safeUrl}">${safeUrl}</a></p><hr style="border:0;border-top:1px solid #b9c0b5;margin:32px 0"><p style="font-size:12px;color:#6b746e">If you did not make this request, you can ignore this email.</p></div></body></html>`;
  const text = `${heading}\n\n${greeting}\n\n${body}\n\n${action}: ${url}\n\n${expires}\n\nIf you did not make this request, you can ignore this email.`;
  return { html, text };
}

async function sendTransactional(input: MessageInput): Promise<void> {
  const config = requiredMailConfig();
  const configuredTemplate = templateId(input.template);
  const to: Recipient = { email: input.to };
  if (input.name.trim()) to.name = input.name.trim();

  const payload = configuredTemplate
    ? {
        sender: config.sender,
        to: [to],
        templateId: configuredTemplate,
        params: input.params ?? {},
      }
    : {
        sender: config.sender,
        to: [to],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
      };

  await brevoRequest(
    "/smtp/email",
    { method: "POST", body: JSON.stringify(payload) },
    { apiKey: config.apiKey }
  );
}

export async function sendVerificationMessage({
  email,
  name,
  url,
}: {
  email: string;
  name: string;
  url: string;
}): Promise<void> {
  const content = actionEmail({
    heading: "Verify your place on the Committee",
    greeting: `Hello ${name || "there"},`,
    body: "Confirm this email address before signing in or entering a ruling.",
    action: "Verify email",
    url,
    expires: "This verification link expires in one hour.",
  });
  await sendTransactional({
    to: email,
    name,
    subject: "Verify your Bhashan Board email",
    ...content,
    template: "verify",
    params: { name, actionUrl: url },
  });
}

export async function sendPasswordResetMessage({
  email,
  name,
  url,
}: {
  email: string;
  name: string;
  url: string;
}): Promise<void> {
  const content = actionEmail({
    heading: "Reset your Committee key",
    greeting: `Hello ${name || "there"},`,
    body: "A password reset was requested for your Bhashan Board account.",
    action: "Reset password",
    url,
    expires: "This reset link expires in one hour and can only be used once.",
  });
  await sendTransactional({
    to: email,
    name,
    subject: "Reset your Bhashan Board password",
    ...content,
    template: "reset",
    params: { name, actionUrl: url },
  });
}

export async function sendWelcomeMessage({
  email,
  name,
  siteUrl,
}: {
  email: string;
  name: string;
  siteUrl: string;
}): Promise<void> {
  const safeName = escapeHtml(name || "there");
  const safeUrl = escapeHtml(siteUrl);
  await sendTransactional({
    to: email,
    name,
    subject: "Your seat is ready",
    html: `<!doctype html><html><body style="margin:0;background:#eef0e7;color:#101813;font-family:Georgia,serif"><div style="max-width:620px;margin:0 auto;padding:40px 24px"><p style="font:700 11px Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#9d1f31">The Bhashan Board</p><h1 style="font-size:34px;font-weight:400">Your seat is ready</h1><p>Hello ${safeName},</p><p style="line-height:1.65">Your email is verified. Watch the evidence, then enter one ruling for each statement.</p><p style="margin:30px 0"><a href="${safeUrl}" style="display:inline-block;background:#9d1f31;color:#fff;padding:13px 20px;text-decoration:none;font:700 12px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase">Enter the record</a></p></div></body></html>`,
    text: `Your seat is ready\n\nHello ${name || "there"},\n\nYour email is verified. Watch the evidence, then enter one ruling for each statement.\n\n${siteUrl}`,
    template: "welcome",
    params: { name, siteUrl },
  });
}

export async function sendSubmissionAcknowledgement({
  email,
  name,
  reference,
  siteUrl,
}: {
  email: string;
  name: string;
  reference: string;
  siteUrl: string;
}): Promise<void> {
  const safeName = escapeHtml(name || "there");
  const safeReference = escapeHtml(reference);
  const safeSiteUrl = escapeHtml(siteUrl);
  await sendTransactional({
    to: email,
    name,
    subject: `Evidence received · ${reference}`,
    html: `<!doctype html><html><body style="margin:0;background:#eef0e7;color:#101813;font-family:Georgia,serif"><div style="max-width:620px;margin:0 auto;padding:40px 24px"><p style="font:700 11px Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#9d1f31">The Bhashan Board</p><h1 style="font-size:34px;font-weight:400">Your evidence is in the queue</h1><p>Hello ${safeName},</p><p style="line-height:1.65">Thank you for sending a lead. Its private reference is <strong>${safeReference}</strong>. The Committee will check the original wording, surrounding context, source and footage before deciding whether to create a draft.</p><p style="line-height:1.65">Nothing is published automatically, and an acknowledgement is not an endorsement of the claim.</p><p style="margin:30px 0"><a href="${safeSiteUrl}" style="display:inline-block;background:#9d1f31;color:#fff;padding:13px 20px;text-decoration:none;font:700 12px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase">Visit the Board</a></p></div></body></html>`,
    text: `Your evidence is in the queue\n\nHello ${name || "there"},\n\nThank you for sending a lead. Its private reference is ${reference}. The Committee will check the wording, context, source and footage before deciding whether to create a draft.\n\nNothing is published automatically, and this acknowledgement is not an endorsement.\n\n${siteUrl}`,
    template: "submission",
    params: { name, reference, siteUrl },
  });
}

export function safeBrevoError(error: unknown): string {
  if (error instanceof BrevoConfigurationError) return error.message;
  if (error instanceof BrevoRequestError) return `Brevo HTTP ${error.status}`;
  return "Unexpected Brevo error";
}
