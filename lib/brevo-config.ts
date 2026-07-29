const PLACEHOLDER_PATTERN =
  /(?:replace|change|example|placeholder|your[-_ ]?(?:api[-_ ]?)?key|insert[-_ ]?key|changeme)/i;

export type MailEnvironment = Partial<
  Record<
    | "BREVO_API_KEY"
    | "BREVO_SENDER_EMAIL"
    | "BREVO_VERIFY_TEMPLATE_ID"
    | "BREVO_RESET_TEMPLATE_ID"
    | "BREVO_WELCOME_TEMPLATE_ID"
    | "BREVO_SUBMISSION_TEMPLATE_ID",
    string | undefined
  >
>;

function configuredValue(source: MailEnvironment, name: keyof MailEnvironment): string {
  return source[name]?.trim() ?? "";
}

export function brevoApiKeyIsAcceptable(value: string | undefined): boolean {
  const candidate = value?.trim() ?? "";
  return candidate.length >= 20 && !PLACEHOLDER_PATTERN.test(candidate);
}

export function senderEmailIsAcceptable(value: string | undefined): boolean {
  const candidate = value?.trim() ?? "";
  if (!candidate || candidate.length > 254 || /[\r\n]/.test(candidate)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate);
}

export function mailConfigurationIssues(source: MailEnvironment): string[] {
  const issues: string[] = [];
  if (!brevoApiKeyIsAcceptable(configuredValue(source, "BREVO_API_KEY"))) {
    issues.push("BREVO_API_KEY");
  }
  if (!senderEmailIsAcceptable(configuredValue(source, "BREVO_SENDER_EMAIL"))) {
    issues.push("BREVO_SENDER_EMAIL");
  }

  for (const name of [
    "BREVO_VERIFY_TEMPLATE_ID",
    "BREVO_RESET_TEMPLATE_ID",
    "BREVO_WELCOME_TEMPLATE_ID",
    "BREVO_SUBMISSION_TEMPLATE_ID",
  ] as const) {
    const value = configuredValue(source, name);
    if (value && (!/^\d+$/.test(value) || Number(value) < 1)) issues.push(name);
  }
  return issues;
}
