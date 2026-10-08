import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

export function createSigningInvitationToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(TOKEN_BYTES).toString('hex');

  return {
    token,
    tokenHash: hashSigningInvitationToken(token),
  };
}

export function hashSigningInvitationToken(token: string): string {
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new Error('Invalid signing invitation token');
  }

  return createHash('sha256')
    .update(token, 'utf8')
    .digest('hex');
}

export function verifySigningInvitationToken(
  token: string,
  expectedHash: string,
): boolean {
  if (
    !/^[a-f0-9]{64}$/.test(token) ||
    !/^[a-f0-9]{64}$/.test(expectedHash)
  ) {
    return false;
  }

  const actual = Buffer.from(hashSigningInvitationToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return timingSafeEqual(actual, expected);
}
