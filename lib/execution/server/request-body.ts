import 'server-only';

/** Enforce byte limits while reading, including requests without Content-Length. */
export async function readExecutionJson(request: Request, limit: number): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || !request.body) throw new Error('JSON body required');
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new Error('Request exceeds limit');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.length;
      if (size > limit) { await reader.cancel(); throw new Error('Request exceeds limit'); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  const body: unknown = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('JSON object required');
  return body as Record<string,unknown>;
}
