import { NextRequest, NextResponse } from 'next/server';
import { executionServiceClient } from '@/lib/execution/server/verification-api';
import { submitVerifiedSignature } from '@/lib/execution/server/signature-submission';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (
    process.env.EXECUTION_PUBLIC_SIGNING_ENABLED !== 'true' ||
    process.env.EXECUTION_EMAIL_OTP_ENABLED !== 'true'
  ) {
    return NextResponse.json({ error: 'Signing unavailable' }, { status: 503 });
  }

  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    if (
      typeof input.token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(input.token) ||
      typeof input.verificationId !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(input.verificationId) ||
      typeof input.signatureDataUrl !== 'string' ||
      input.signatureDataUrl.length > 250000 ||
      input.signatureMethod !== 'typed' ||
      input.consentAccepted !== true
    ) {
      return NextResponse.json({ error: 'Invalid signing submission' }, { status: 400 });
    }

    const result = await submitVerifiedSignature(executionServiceClient(), {
      signingToken: input.token,
      verificationId: input.verificationId,
      signatureDataUrl: input.signatureDataUrl,
      signatureMethod: 'typed',
      consentAccepted: true,
      authorityDeclaration: typeof input.authorityDeclaration === 'string'
        ? input.authorityDeclaration : null,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      signed: true,
      signedAt: result.signedAt,
      remainingParticipants: result.remainingParticipants,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'Signature could not be completed. Contact your leasing manager before retrying.' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
