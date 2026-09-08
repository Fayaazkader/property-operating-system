export type CsvRow = string[];

/**
 * Canonical CSV parser for all banking imports.
 *
 * Handles:
 * - comma-separated values
 * - quoted fields
 * - commas inside quoted fields
 * - escaped quotes ("")
 * - Windows / Unix line endings
 * - blank lines
 */
export function parseCSV(text: string): CsvRow[] {
  const rows: CsvRow[] = [];

  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(field.trim());
      field = "";

      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    field += char;
  }

  // Final field / row
  row.push(field.trim());

  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}