import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, mock } from 'node:test';
import { PDFDocument } from 'pdf-lib';

import {
  convertExecutionDocument,
} from '../../lib/execution/server/document-conversion-core.ts';

const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

async function samplePdf(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.addPage([595, 842]);
  return document.save();
}

async function sampleDocxInput() {
  const bytes = new Uint8Array([80, 75, 3, 4]);

  return {
    bytes,
    format: 'docx' as const,
    filename: 'approved-lease.docx',
    expectedSourceChecksum: sha256(bytes),
  };
}

test('accepts a valid PDF with a matching checksum', async () => {
  const bytes = await samplePdf();

  const result = await convertExecutionDocument({
    bytes,
    format: 'pdf',
    filename: 'document.pdf',
    expectedSourceChecksum: sha256(bytes),
  });

  assert.equal(result.pageCount, 1);
  assert.equal(result.pdfChecksum, sha256(bytes));
  assert.equal(result.conversionProvider, 'original-pdf');
});

test('rejects a source checksum mismatch', async () => {
  const bytes = await samplePdf();

  await assert.rejects(
    convertExecutionDocument({
      bytes,
      format: 'pdf',
      filename: 'document.pdf',
      expectedSourceChecksum: '0'.repeat(64),
    }),
    /checksum mismatch/,
  );
});

test('rejects malformed PDF content', async () => {
  const bytes = new TextEncoder().encode('%PDF-not-a-real-document');

  await assert.rejects(
    convertExecutionDocument({
      bytes,
      format: 'pdf',
      filename: 'document.pdf',
      expectedSourceChecksum: sha256(bytes),
    }),
  );
});

test('rejects oversized source documents', async () => {
  const bytes = new Uint8Array(20 * 1024 * 1024 + 1);

  await assert.rejects(
    convertExecutionDocument({
      bytes,
      format: 'pdf',
      filename: 'oversized.pdf',
      expectedSourceChecksum: sha256(bytes),
    }),
    /Invalid execution source document/,
  );
});

test('rejects DOCX conversion when unconfigured', async () => {
  const previousUrl = process.env.EXECUTION_CONVERTER_URL;
  const previousToken = process.env.EXECUTION_CONVERTER_TOKEN;

  try {
    delete process.env.EXECUTION_CONVERTER_URL;
    delete process.env.EXECUTION_CONVERTER_TOKEN;

    await assert.rejects(
      convertExecutionDocument(await sampleDocxInput()),
      /not configured/,
    );
  } finally {
    if (previousUrl === undefined) {
      delete process.env.EXECUTION_CONVERTER_URL;
    } else {
      process.env.EXECUTION_CONVERTER_URL = previousUrl;
    }

    if (previousToken === undefined) {
      delete process.env.EXECUTION_CONVERTER_TOKEN;
    } else {
      process.env.EXECUTION_CONVERTER_TOKEN = previousToken;
    }
  }
});

test('rejects HTTP converter endpoints', async () => {
  const previousUrl = process.env.EXECUTION_CONVERTER_URL;
  const previousToken = process.env.EXECUTION_CONVERTER_TOKEN;

  try {
    process.env.EXECUTION_CONVERTER_URL = 'http://converter.invalid';
    process.env.EXECUTION_CONVERTER_TOKEN = 'test-token';

    await assert.rejects(
      convertExecutionDocument(await sampleDocxInput()),
      /must use HTTPS/,
    );
  } finally {
    if (previousUrl === undefined) {
      delete process.env.EXECUTION_CONVERTER_URL;
    } else {
      process.env.EXECUTION_CONVERTER_URL = previousUrl;
    }

    if (previousToken === undefined) {
      delete process.env.EXECUTION_CONVERTER_TOKEN;
    } else {
      process.env.EXECUTION_CONVERTER_TOKEN = previousToken;
    }
  }
});

test('rejects streaming overflow without Content-Length', async () => {
  const previousUrl = process.env.EXECUTION_CONVERTER_URL;
  const previousToken = process.env.EXECUTION_CONVERTER_TOKEN;

  process.env.EXECUTION_CONVERTER_URL = 'https://converter.example';
  process.env.EXECUTION_CONVERTER_TOKEN = 'test-token';

  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16 * 1024 * 1024));
        controller.enqueue(new Uint8Array(15 * 1024 * 1024));
        controller.close();
      },
    });

    return new Response(stream, { status: 200 });
  });

  try {
    await assert.rejects(
      convertExecutionDocument(await sampleDocxInput()),
      /exceeds size limit/,
    );

    assert.equal(fetchMock.mock.callCount(), 1);
  } finally {
    fetchMock.mock.restore();

    if (previousUrl === undefined) {
      delete process.env.EXECUTION_CONVERTER_URL;
    } else {
      process.env.EXECUTION_CONVERTER_URL = previousUrl;
    }

    if (previousToken === undefined) {
      delete process.env.EXECUTION_CONVERTER_TOKEN;
    } else {
      process.env.EXECUTION_CONVERTER_TOKEN = previousToken;
    }
  }
});

test('rejects an oversized converter response before reading its body', async () => {
  const previousUrl = process.env.EXECUTION_CONVERTER_URL;
  const previousToken = process.env.EXECUTION_CONVERTER_TOKEN;

  process.env.EXECUTION_CONVERTER_URL = 'https://converter.example';
  process.env.EXECUTION_CONVERTER_TOKEN = 'test-token';

  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return new Response('oversized', {
      status: 200,
      headers: {
        'content-length': String(31 * 1024 * 1024),
      },
    });
  });

  try {
    await assert.rejects(
      convertExecutionDocument(await sampleDocxInput()),
      /exceeds size limit/,
    );

    assert.equal(fetchMock.mock.callCount(), 1);

    const options = fetchMock.mock.calls[0].arguments[1];

    assert.equal(options?.redirect, 'error');
  } finally {
    fetchMock.mock.restore();

    if (previousUrl === undefined) {
      delete process.env.EXECUTION_CONVERTER_URL;
    } else {
      process.env.EXECUTION_CONVERTER_URL = previousUrl;
    }

    if (previousToken === undefined) {
      delete process.env.EXECUTION_CONVERTER_TOKEN;
    } else {
      process.env.EXECUTION_CONVERTER_TOKEN = previousToken;
    }
  }
});
