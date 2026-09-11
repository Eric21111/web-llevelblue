/**
 * Turn a DB timestamp into a short relative label.
 * Dummy values such as "Just now" (no real clock time) render as "—".
 */
export function formatLastActive(value, now = Date.now()) {
  if (value === null || value === undefined || value === "") return "—";

  const text = String(value).trim();
  if (!text || text.toLowerCase() === "just now") return "—";

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "—";

  const diffMs = now - parsed.getTime();
  if (diffMs < 60 * 1000) return "Just now";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diffMs / 3600000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diffMs / 86400000);
  if (days < 7) return `${days}d ago`;

  return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
