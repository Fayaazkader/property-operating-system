import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 3000);
const MAX_REQUEST_BYTES = 21 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 30 * 1024 * 1024;

const GOTENBERG_URL =
  process.env.GOTENBERG_URL ||
  'http://gotenberg.railway.internal:3000';

const TOKEN = process.env.CONVERTER_GATEWAY_TOKEN;

if (!TOKEN || TOKEN.length < 32) {
  throw new Error('CONVERTER_GATEWAY_TOKEN must contain at least 32 characters');
}

const upstream = new URL(
  '/forms/libreoffice/convert',
  GOTENBERG_URL
);

if (
  upstream.protocol !== 'http:' ||
  upstream.hostname !== 'gotenberg.railway.internal' ||
  upstream.port !== '3000'
) {
  throw new Error('Invalid private Gotenberg configuration');
}

function authorized(header) {
  if (!header?.startsWith('Bearer ')) return false;

  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(TOKEN);

  return supplied.length === expected.length &&
    timingSafeEqual(supplied, expected);
}

function send(res, status, message) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(JSON.stringify({ error: message }));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (
    req.method !== 'POST' ||
    req.url !== '/forms/libreoffice/convert'
  ) {
    send(res, 404, 'Not found');
    return;
  }

  if (!authorized(req.headers.authorization)) {
    send(res, 401, 'Unauthorized');
    return;
  }

  const contentType = req.headers['content-type'] || '';

  if (!contentType.startsWith('multipart/form-data;')) {
    send(res, 415, 'Multipart upload required');
    return;
  }

  const declaredLength = Number(req.headers['content-length']);

  if (
    req.headers['content-length'] &&
    (!Number.isSafeInteger(declaredLength) ||
      declaredLength > MAX_REQUEST_BYTES)
  ) {
    send(res, 413, 'Request too large');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const chunks = [];
    let size = 0;

    for await (const chunk of req) {
      size += chunk.length;

      if (size > MAX_REQUEST_BYTES) {
        send(res, 413, 'Request too large');
        return;
      }

      chunks.push(chunk);
    }

    const response = await fetch(upstream, {
      method: 'POST',
      headers: {
        'content-type': contentType
      },
      body: Buffer.concat(chunks),
      signal: controller.signal,
      redirect: 'error'
    });

    if (!response.ok) {
      send(res, 502, 'Document conversion failed');
      return;
    }

    if (
      response.headers.get('content-length') &&
      Number(response.headers.get('content-length')) >
        MAX_RESPONSE_BYTES
    ) {
      send(res, 502, 'Converted document too large');
      return;
    }

    if (!response.body) {
      send(res, 502, 'Empty conversion response');
      return;
    }

    const reader = response.body.getReader();
    const pdfChunks = [];
    let pdfSize = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pdfSize += value.byteLength;

        if (pdfSize > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          send(res, 502, 'Converted document too large');
          return;
        }

        pdfChunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    const pdf = Buffer.concat(pdfChunks);

    if (
      pdf.length < 5 ||
      pdf.subarray(0, 5).toString('ascii') !== '%PDF-'
    ) {
      send(res, 502, 'Invalid conversion response');
      return;
    }

    res.writeHead(200, {
      'content-type': 'application/pdf',
      'content-length': pdf.length,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    });

    res.end(pdf);
  } catch {
    if (!res.headersSent) {
      send(res, 502, 'Conversion service unavailable');
    }
  } finally {
    clearTimeout(timeout);
  }
});

server.requestTimeout = 60000;
server.headersTimeout = 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`AssetFlow converter gateway listening on ${PORT}`);
});
