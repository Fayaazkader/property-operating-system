import * as XLSX from "xlsx";

import { parseCSV } from "@/lib/document-intelligence/ingestion/csv-parser";
import { extractTextFromBuffer } from "../ocr-adapter";

import type {
  DocumentIngestionResult,
  SupportedDocumentFormat,
} from "./types";

export type { DocumentIngestionResult, SupportedDocumentFormat } from "./types";

function detectFormat(
  fileName: string,
  mimeType: string
): SupportedDocumentFormat {
  const extension = fileName
    .toLowerCase()
    .split(".")
    .pop();

  if (extension === "csv" || mimeType === "text/csv") {
    return "csv";
  }

  if (
    extension === "xls" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return "xls";
  }

  if (
    extension === "xlsx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }

  if (
    extension === "pdf" ||
    mimeType === "application/pdf"
  ) {
    return "pdf";
  }

  if (
    extension === "png" ||
    extension === "jpg" ||
    extension === "jpeg" ||
    mimeType.startsWith("image/")
  ) {
    return "image";
  }

  throw new Error(
    `Unsupported document format: ${fileName}. Supported formats are CSV, XLS, XLSX, PDF, PNG, JPG and JPEG.`
  );
}

function normalizeRows(rows: unknown[][]): string[][] {
  return rows.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) {
        return "";
      }

      if (cell instanceof Date) {
        return cell.toISOString().slice(0, 10);
      }

      return String(cell).trim();
    })
  );
}

async function ingestSpreadsheet(
  buffer: ArrayBuffer
): Promise<string[][]> {
  const workbook = XLSX.read(Buffer.from(buffer), {
    type: "buffer",
    cellDates: true,
    raw: false,
  });

  if (!workbook.SheetNames.length) {
    throw new Error("Spreadsheet contains no worksheets.");
  }

  const rows: string[][] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) continue;

    const sheetRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];

    if (sheetRows.length === 0) continue;

    if (rows.length > 0) {
      rows.push([""]);
    }

    rows.push(...normalizeRows(sheetRows));
  }

  if (rows.length === 0) {
    throw new Error("Spreadsheet contains no readable data.");
  }

  return rows;
}

export async function ingestDocument(
  file: File
): Promise<DocumentIngestionResult> {
  const buffer = await file.arrayBuffer();

  if (!buffer.byteLength) {
    throw new Error("File is empty.");
  }

  const format = detectFormat(file.name, file.type);

  if (format === "csv") {
    const text = new TextDecoder().decode(buffer);
    const rows = parseCSV(text);

    if (rows.length === 0) {
      throw new Error("CSV contains no readable data.");
    }

    return {
      format,
      fileName: file.name,
      mimeType: file.type || "text/csv",
      sizeBytes: buffer.byteLength,
      content: {
        kind: "structured",
        rows,
      },
    };
  }

  if (format === "xls" || format === "xlsx") {
    return {
      format,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: buffer.byteLength,
      content: {
        kind: "structured",
        rows: await ingestSpreadsheet(buffer),
      },
    };
  }

  const ocrResult = await extractTextFromBuffer(
    buffer,
    file.type || (format === "pdf" ? "application/pdf" : "image/png")
  );

  if (!ocrResult.text.trim()) {
    throw new Error(
      "No readable text could be extracted from the document."
    );
  }

  return {
    format,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: buffer.byteLength,
    content: {
      kind: "text",
      text: ocrResult.text,
      rawText: ocrResult.rawText,
      confidence: ocrResult.confidence,
      provider: ocrResult.provider,
      method: ocrResult.method,
      pageCount: ocrResult.pageCount,
      evidence: ocrResult.evidence,
    },
  };
}
