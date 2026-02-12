/**
 * Échappe les caractères HTML pour prévenir les injections XSS dans les templates email
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

const HTML_ESCAPE_REGEX = /[&<>"'/]/g;

export function escapeHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] || char);
}
