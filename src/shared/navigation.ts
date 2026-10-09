export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://tripsync.invalid");
    if (url.origin !== "https://tripsync.invalid" || ["/login", "/auth/callback"].includes(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}

const returnKey = "tripsync-return-to";
export function saveReturnPath(value: string) { sessionStorage.setItem(returnKey, safeReturnPath(value)); }
export function consumeReturnPath() {
  const path = safeReturnPath(sessionStorage.getItem(returnKey));
  sessionStorage.removeItem(returnKey);
  return path;
}
