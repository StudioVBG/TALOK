export function cleanAttachmentName(raw: string): string {
  let name = raw.replace(/^u\d+_/, "");
  name = name.replace(/_?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_?/gi, "_");
  name = name.replace(/_\d+(\.[a-z0-9]+)$/i, "$1");
  const ext = name.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ").trim();
  return base + ext;
}

export function truncateMiddle(name: string, max = 40): string {
  if (name.length <= max) return name;
  const ext = name.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
  const base = name.replace(/\.[a-z0-9]+$/i, "");
  const keep = Math.floor((max - ext.length - 1) / 2);
  return base.slice(0, keep) + "…" + base.slice(-keep) + ext;
}
