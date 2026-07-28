/** Keep auth callbacks on this origin; never pass an arbitrary URL to a redirect. */
export function safeAuthReturnPath(value: string | undefined, fallback = "/account"): string {
  if (
    !value ||
    !/^\/(?!\/)[^\\\r\n]*$/.test(value) ||
    value.startsWith("/api/auth")
  ) {
    return fallback;
  }
  return value;
}
