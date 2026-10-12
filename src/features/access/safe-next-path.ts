/** Keep OAuth return destinations inside this application. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/groups";
  }

  if (/[\\\u0000-\u001f\u007f]/.test(value) || /%(?:2f|5c)/i.test(value)) {
    return "/groups";
  }

  try {
    const url = new URL(value, "https://tripsync.invalid");
    if (url.origin !== "https://tripsync.invalid") return "/groups";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/groups";
  }
}
