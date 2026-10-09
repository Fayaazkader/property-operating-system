
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';

export type ExecutionSourceFormat = 'pdf' | 'docx';

export interface ExecutionConversionInput {
  bytes: Uint8Array;
  format: ExecutionSourceFormat;
  expectedSourceChecksum: string;
  filename: string;
}

export interface ExecutionConversionResult {
  pdfBytes: Uint8Array;
  sourceChecksum: string;
  pdfChecksum: string;
  sourceFormat: ExecutionSourceFormat;
  pageCount: number;
  conversionProvider: 'original-pdf' | 'gotenberg';
}

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_BYTES = 30 * 1024 * 1024;

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function verifyChecksum(
  actual: string,
  expected: string,
): void {
  if (
    !/^[a-f0-9]{64}$/.test(expected) ||
    actual !== expected
  ) {
    throw new Error('Execution document checksum mismatch');
  }
}

async function validatePdf(bytes: Uint8Array): Promise<number> {
  if (
    bytes.length === 0 ||
    bytes.length > MAX_PDF_BYTES ||
    Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-'
  ) {
    throw new Error('Invalid execution PDF');
  }

  const pdf = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
  });

  const pageCount = pdf.getPageCount();

  if (pageCount < 1 || pageCount > 500) {
    throw new Error('Invalid execution PDF page count');
  }

  return pageCount;
}

export async function convertExecutionDocument(
  input: ExecutionConversionInput,
): Promise<ExecutionConversionResult> {
  if (
    !(input.bytes instanceof Uint8Array) ||
    input.bytes.length === 0 ||
    input.bytes.length > MAX_SOURCE_BYTES
  ) {
    throw new Error('Invalid execution source document');
  }

  const sourceChecksum = sha256(input.bytes);

  verifyChecksum(
    sourceChecksum,
    input.expectedSourceChecksum,
  );

  let pdfBytes: Uint8Array;
  let conversionProvider: ExecutionConversionResult['conversionProvider'];

  if (input.format === 'pdf') {
    pdfBytes = input.bytes;
    conversionProvider = 'original-pdf';
  } else if (input.format === 'docx') {
    const baseUrl = process.env.EXECUTION_CONVERTER_URL;
    const token = process.env.EXECUTION_CONVERTER_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Execution PDF conversion is not configured');
    }

    const url = new URL('/forms/libreoffice/convert', baseUrl);

    if (url.protocol !== 'https:') {
      throw new Error('Execution converter must use HTTPS');
    }

    if (
      !input.filename.toLowerCase().endsWith('.docx') ||
      input.filename.includes('/') ||
      input.filename.includes('\\')
    ) {
      throw new Error('Invalid DOCX filename');
    }

    const form = new FormData();
    form.append(
      'files',
      new Blob(
        [Buffer.from(input.bytes)],
        {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ),
      input.filename,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error('Execution document conversion failed');
    }

    const contentLength = response.headers.get('content-length');

    if (
      contentLength &&
      Number(contentLength) > MAX_PDF_BYTES
    ) {
      throw new Error('Converted PDF exceeds size limit');
    }

    if (!response.body) {
      throw new Error('Converter returned no document');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;

        if (totalBytes > MAX_PDF_BYTES) {
          await reader.cancel();
          throw new Error('Converted PDF exceeds size limit');
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    pdfBytes = bytes;
    conversionProvider = 'gotenberg';
  } else {
    throw new Error('Unsupported execution document format');
  }

  const pageCount = await validatePdf(pdfBytes);

  return {
    pdfBytes,
    sourceChecksum,
    pdfChecksum: sha256(pdfBytes),
    sourceFormat: input.format,
    pageCount,
    conversionProvider,
  };
}
