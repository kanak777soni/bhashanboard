/** Return a canonical HTTPS origin for the public R2 delivery bucket. */
export function normalizeR2PublicBaseUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    return undefined;
  }
  return parsed.origin;
}
