/**
 * Only same-site relative paths are allowed as post-login destinations. Anything that
 * could leave the site (absolute URLs, protocol-relative //host, backslash tricks,
 * control characters) falls back to the dashboard.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (value.length === 0 || value.length > 512) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  if (value.startsWith("/auth/") || value === "/login" || value === "/signup" || value === "/forgot-password") return "/";
  return value;
}
