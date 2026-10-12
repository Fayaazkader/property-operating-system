import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PDFDocument } = require('pdf-lib');

const {
  convertExecutionDocument,
} = require('../../lib/execution/server/document-conversion-core.ts');

const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXECUTION_CONVERTER_URL;
const originalToken = process.env.EXECUTION_CONVERTER_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalUrl === undefined) {
    delete process.env.EXECUTION_CONVERTER_URL;
  } else {
    process.env.EXECUTION_CONVERTER_URL = originalUrl;
  }

  if (originalToken === undefined) {
    delete process.env.EXECUTION_CONVERTER_TOKEN;
  } else {
    process.env.EXECUTION_CONVERTER_TOKEN = originalToken;
  }
});

const sha256 = bytes =>
  createHash('sha256').update(bytes).digest('hex');

const source = new Uint8Array([80, 75, 3, 4, 1, 2, 3]);

const input = () => ({
  bytes: source,
  format: 'docx',
  expectedSourceChecksum: sha256(source),
  filename: 'approved-lease.docx',
});

function configure() {
  process.env.EXECUTION_CONVERTER_URL =
    'https://converter.example.test';
  process.env.EXECUTION_CONVERTER_TOKEN =
    'test-token';
}

async function samplePdf() {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  return new Uint8Array(await pdf.save());
}

test('rejects incorrect source checksum before conversion', async () => {
  configure();

  globalThis.fetch = () => {
    throw new Error('HTTP must not be called');
  };

  await assert.rejects(
    convertExecutionDocument({
      ...input(),
      expectedSourceChecksum: '0'.repeat(64),
    }),
    /checksum mismatch/i,
  );
});

test('rejects missing converter configuration', async () => {
  delete process.env.EXECUTION_CONVERTER_URL;
  delete process.env.EXECUTION_CONVERTER_TOKEN;

  await assert.rejects(
    convertExecutionDocument(input()),
    /not configured/i,
  );
});

test('rejects non-HTTPS converter URLs', async () => {
  configure();
  process.env.EXECUTION_CONVERTER_URL =
    'http://converter.example.test';

  await assert.rejects(
    convertExecutionDocument(input()),
    /must use HTTPS/i,
  );
});

test('sends authenticated multipart DOCX and verifies PDF', async () => {
  configure();

  const pdf = await samplePdf();
  let calls = 0;

  globalThis.fetch = async (url, options) => {
    calls++;

    assert.equal(
      String(url),
      'https://converter.example.test/forms/libreoffice/convert',
    );

    assert.equal(options.method, 'POST');
    assert.equal(
      options.headers.Authorization,
      'Bearer test-token',
    );

    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.body instanceof FormData);

    const file = options.body.get('files');

    assert.ok(file);
    assert.equal(file.name, 'approved-lease.docx');
    assert.deepEqual(
      new Uint8Array(await file.arrayBuffer()),
      source,
    );

    return new Response(pdf, {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    });
  };

  const result = await convertExecutionDocument(input());

  assert.equal(calls, 1);
  assert.equal(result.conversionProvider, 'gotenberg');
  assert.equal(result.pageCount, 1);
  assert.equal(result.sourceChecksum, sha256(source));
  assert.equal(result.pdfChecksum, sha256(pdf));
});

test('rejects failed conversion responses', async () => {
  configure();

  globalThis.fetch = async () =>
    new Response('Conversion failed', { status: 500 });

  await assert.rejects(
    convertExecutionDocument(input()),
    /conversion failed/i,
  );
});

test('rejects malformed converted PDFs', async () => {
  configure();

  globalThis.fetch = async () =>
    new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
    });

  await assert.rejects(
    convertExecutionDocument(input()),
    /invalid execution PDF/i,
  );
});

test('rejects oversized PDF response headers', async () => {
  configure();

  globalThis.fetch = async () =>
    new Response('ignored', {
      status: 200,
      headers: {
        'content-length': String(31 * 1024 * 1024),
      },
    });

  await assert.rejects(
    convertExecutionDocument(input()),
    /exceeds size limit/i,
  );
});

test('rejects unsafe DOCX filenames', async () => {
  configure();

  await assert.rejects(
    convertExecutionDocument({
      ...input(),
      filename: '../approved-lease.docx',
    }),
    /invalid DOCX filename/i,
  );
});
