const PLACARD = /SEAMUN-\d{4}-[A-Z]+-\d+/i;

export function parseBadgeCode(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  const direct = text.match(PLACARD);
  if (direct) return direct[0].toUpperCase();

  try {
    const url = new URL(text);
    const nested =
      url.searchParams.get("id") ??
      url.searchParams.get("code") ??
      url.searchParams.get("placard") ??
      "";
    if (nested) return parseBadgeCode(nested);
    const fromPath = url.pathname.split("/").filter(Boolean).pop() ?? "";
    if (fromPath) return parseBadgeCode(decodeURIComponent(fromPath));
  } catch {
    // Allocation IDs are not URLs.
  }

  return text.replace(/\s+/g, "").toLowerCase();
}
