import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  executionServiceClient,
  verificationResponse,
} from '@/lib/execution/server/verification-api';
import { issueSignerVerification } from '@/lib/execution/server/signer-verification';
import { sendVerificationEmail } from '@/lib/execution/server/verification-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return verificationResponse({ error: 'Invalid request' }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return verificationResponse({ error: 'Invalid request' }, 400);
  }

  if (!body || typeof body !== 'object') {
    return verificationResponse({ error: 'Invalid request' }, 400);
  }

  const { token } = body as { token?: unknown };
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    return verificationResponse({ error: 'Invalid invitation' }, 400);
  }

  // Do not permit OTP issuance until the complete controlled signing
  // flow and production database migrations have been verified.
  if (process.env.EXECUTION_EMAIL_OTP_ENABLED !== 'true') {
    return verificationResponse({ error: 'Verification unavailable' }, 503);
  }

  try {
    const client = executionServiceClient();
    const challenge = await issueSignerVerification(client, token, 'email');

    let accepted = false;

    try {
      await sendVerificationEmail({
        destination: challenge.destination,
        code: challenge.code,
      });
      accepted = true;
    } catch {
      accepted = false;
    }

    const { data, error } = await client.rpc(
      'complete_execution_verification_delivery',
      {
        p_verification_id: challenge.verificationId,
        p_accepted: accepted,
      },
    );

    if (error || data !== true || !accepted) {
      return verificationResponse(
        { error: 'Verification unavailable' },
        503,
      );
    }

    return verificationResponse({
      verificationId: challenge.verificationId,
      message: 'Verification code sent.',
    });
  } catch {
    return verificationResponse(
      { error: 'Verification unavailable' },
      503,
    );
  }
}
