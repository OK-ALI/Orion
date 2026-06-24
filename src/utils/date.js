/**
 * Formats a TMDB date string (YYYY-MM-DD) into a human-readable format (e.g. "Jun 24, 2026").
 * Falls back to the original string or "N/A" if empty.
 */
export function formatDate(dateString) {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}
