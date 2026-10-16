import { Workbook } from "exceljs";
import type { ReportLayout } from "../layout/engine";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function uniqueSheetName(
  requested: string,
  usedNames: Set<string>
): string {
  const base =
    requested.replace(/[\\\\/:?*\\[\\]]/g, "").trim() || "Sheet";

  let candidate = base.slice(0, 31);
  let suffix = 1;

  while (usedNames.has(candidate.toLowerCase())) {
    const ending = ` (${suffix++})`;
    candidate = base.slice(0, 31 - ending.length) + ending;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export async function renderXLSX(
  layout: ReportLayout
): Promise<Blob> {
  const workbook = new Workbook();
  const usedNames = new Set<string>();

  for (let i = 0; i < layout.sections.length; i++) {
    const section = layout.sections[i];

    const sheet = workbook.addWorksheet(
      uniqueSheetName(section.title || `Sheet${i + 1}`, usedNames)
    );

    sheet.addRow(section.table.headers);

    for (const row of section.table.rows) {
      sheet.addRow(row);
    }

    if (section.table.totals) {
      sheet.addRow(section.table.totals);
    }
  }

  const info = workbook.addWorksheet(
    uniqueSheetName("Info", usedNames)
  );

  info.addRows([
    ["Report", layout.header.reportTitle],
    ["Company", layout.header.companyName],
    [
      "Generated",
      new Date(layout.header.generatedAt).toLocaleString("en-ZA"),
    ],
  ]);

  const buffer = await workbook.xlsx.writeBuffer();

  return new Blob([new Uint8Array(buffer)], {
    type: XLSX_MIME,
  });
}
