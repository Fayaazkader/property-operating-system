import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

/** Serve the installed PDF.js worker from our own origin; no customer data here. */
export async function GET() {
  const worker = await readFile(join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.js'));
  return new Response(new Uint8Array(worker), { headers: {
    'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  } });
}
