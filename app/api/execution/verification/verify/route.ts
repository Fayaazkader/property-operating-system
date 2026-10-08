import { NextRequest } from 'next/server';
import {
  executionServiceClient,
  verificationResponse,
} from '@/lib/execution/server/verification-api';
import { verifySignerCode } from '@/lib/execution/server/signer-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return verificationResponse({ verified: false }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return verificationResponse({ verified: false }, 400);
  }

  if (!body || typeof body !== 'object') {
    return verificationResponse({ verified: false }, 400);
  }

  const { token, verificationId, code } = body as {
    token?: unknown;
    verificationId?: unknown;
    code?: unknown;
  };

  if (
    typeof token !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(token) ||
    typeof verificationId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(verificationId) ||
    typeof code !== 'string' ||
    !/^[0-9]{6}$/.test(code)
  ) {
    return verificationResponse({ verified: false }, 400);
  }

  if (process.env.EXECUTION_EMAIL_OTP_ENABLED !== 'true') {
    return verificationResponse({ verified: false }, 503);
  }

  try {
    const verified = await verifySignerCode(
      executionServiceClient(),
      token,
      verificationId,
      code,
    );

    return verificationResponse({ verified });
  } catch {
    return verificationResponse({ verified: false }, 503);
  }
}
