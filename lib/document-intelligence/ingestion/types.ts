export type SupportedDocumentFormat =
  | "csv"
  | "xls"
  | "xlsx"
  | "pdf"
  | "image";

export type IngestionContent =
  | {
      kind: "structured";
      rows: string[][];
    }
  | {
      kind: "text";
      text: string;
      rawText: string;
      confidence: number;
      provider: string;
      method: string;
      pageCount?: number;
      evidence?: Array<{
        text: string;
        confidence?: number;
        location?: {
          type: "bbox" | "text_range" | "region";
          page?: number;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          startOffset?: number;
          endOffset?: number;
        };
        source:
          | "pdf_text"
          | "ocr"
          | "docx_text"
          | "doc_text"
          | "image_ocr"
          | "docusign";
      }>;
    };

export interface DocumentIngestionResult {
  format: SupportedDocumentFormat;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content: IngestionContent;
}
