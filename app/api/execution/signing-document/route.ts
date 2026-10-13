import { NextRequest, NextResponse } from 'next/server';
import { executionServiceClient } from '@/lib/execution/server/verification-api';
import { loadInvitedSigningDocument } from '@/lib/execution/server/signing-document-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  if (process.env.EXECUTION_PUBLIC_SIGNING_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Signing unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (
    request.headers.get('content-type')?.split(';')[0] !==
    'application/json'
  ) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 },
    );
  }

  const token =
    body && typeof body === 'object' && 'token' in body
      ? body.token
      : null;

  if (
    typeof token !== 'string' ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return NextResponse.json(
      { error: 'Invalid invitation' },
      { status: 400 },
    );
  }

  try {
    const bytes = await loadInvitedSigningDocument(
      executionServiceClient(),
      token,
    );

    if (!bytes) {
      return NextResponse.json(
        { error: 'Invitation unavailable' },
        { status: 404 },
      );
    }

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="agreement.pdf"',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    console.error('[EXECUTION DOCUMENT] Secure retrieval failed');

    return NextResponse.json(
      { error: 'Document unavailable' },
      { status: 503 },
    );
  }
}