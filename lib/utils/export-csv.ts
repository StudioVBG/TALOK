/**
 * Client-side CSV export utility.
 * Generates a CSV file and triggers download in the browser.
 */

export function exportCSV(
  data: Record<string, unknown>[],
  filename: string,
  columnLabels?: Record<string, string>
): void {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const labels = headers.map((h) => columnLabels?.[h] || h);

  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h] ?? "";
        const str = String(val);
        // Escape commas, quotes, and newlines
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(",")
  );

  const csv = [labels.join(","), ...rows].join("\n");

  // BOM for Excel UTF-8 compatibility
  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
