export interface OCRProvider {
  name: string;
  extractText(fileBuffer: ArrayBuffer, mimeType: string): Promise<OCRResult>;
}

export interface OCRTableCell {
  rowIndex: number;
  columnIndex: number;
  content: string;
  confidence: number;
}

export interface OCRTable {
  rowCount: number;
  columnCount: number;
  cells: OCRTableCell[];
}

export interface OCRKeyValuePair {
  key: string;
  value: string;
  confidence: number;
}

export interface OCRPage {
  pageNumber: number;
  text: string;
  confidence: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
  processedAt: string;
  raw?: unknown;
  pages?: OCRPage[];
  keyValuePairs?: OCRKeyValuePair[];
  tables?: OCRTable[];
}

export interface AzureAnalyzeResult {
  status: string;
  createdDateTime: string;
  lastUpdatedDateTime: string;
  analyzeResult?: {
    content?: string;
    pages?: Array<{
      pageNumber: number;
      confidence: number;
      lines?: Array<{ content: string }>;
    }>;
    paragraphs?: Array<{ content: string; confidence: number }>;
    tables?: Array<{
      rowCount: number;
      columnCount: number;
      cells: Array<{
        rowIndex: number;
        columnIndex: number;
        content: string;
        confidence: number;
      }>;
    }>;
    keyValuePairs?: Array<{
      key: { content: string };
      value: { content: string };
      confidence: number;
    }>;
  };
  error?: { message: string };
}
