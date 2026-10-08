import 'server-only';

import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

const CODE_LENGTH = 6;

function verificationSecret(): string {
  const secret = process.env.EXECUTION_VERIFICATION_SECRET;

  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error(
      'EXECUTION_VERIFICATION_SECRET must contain at least 32 bytes',
    );
  }

  return secret;
}

export function createVerificationCode(): string {
  return randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, '0');
}

export function hashVerificationCode(
  verificationId: string,
  code: string,
): string {
  if (!/^[0-9]{6}$/.test(code)) {
    throw new Error('Invalid verification code format');
  }

  return createHmac('sha256', verificationSecret())
    .update('execution-otp:v1:')
    .update(verificationId)
    .update(':')
    .update(code)
    .digest('hex');
}

export function hashVerificationDestination(
  destination: string,
): string {
  const normalised = destination.trim().toLowerCase();

  if (!normalised) {
    throw new Error('Verification destination is required');
  }

  return createHmac('sha256', verificationSecret())
    .update('execution-destination:v1:')
    .update(normalised)
    .digest('hex');
}

export function verifyVerificationCode(
  verificationId: string,
  suppliedCode: string,
  expectedHash: string,
): boolean {
  if (
    !/^[0-9]{6}$/.test(suppliedCode) ||
    !/^[a-f0-9]{64}$/.test(expectedHash)
  ) {
    return false;
  }

  const actualHash = hashVerificationCode(
    verificationId,
    suppliedCode,
  );

  return timingSafeEqual(
    Buffer.from(actualHash, 'hex'),
    Buffer.from(expectedHash, 'hex'),
  );
}
