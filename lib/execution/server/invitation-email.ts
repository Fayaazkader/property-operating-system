import 'server-only';

export interface InvitationEmailInput {
  destination: string;
  signerName: string;
  signingUrl: string;
  expiresAt: string;
  idempotencyKey: string;
}

export interface InvitationEmailResult {
  provider: 'resend';
  providerMessageId: string;
}

export async function sendSigningInvitationEmail(
  input: InvitationEmailInput,
): Promise<InvitationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EXECUTION_VERIFICATION_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error('Signing invitation email is not configured');
  }

  if (
    !input.destination.trim() ||
    !input.signerName.trim() ||
    !input.signingUrl.trim() ||
    !input.idempotencyKey.trim()
  ) {
    throw new Error('Invalid signing invitation email parameters');
  }

  const signingUrl = new URL(input.signingUrl);

  if (
    signingUrl.protocol !== 'https:' &&
    signingUrl.hostname !== 'localhost'
  ) {
    throw new Error('Invalid signing invitation URL');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.destination],
      subject: 'AssetFlow — Agreement awaiting your signature',
      text: [
        `Dear ${input.signerName},`,
        '',
        'An agreement has been prepared for your secure electronic signature.',
        '',
        'Open your signing link:',
        input.signingUrl,
        '',
        `This invitation expires on ${input.expiresAt}.`,
        '',
        'For your security, do not forward this link.',
        'You will be asked to verify your email before signing.',
        '',
        'AssetFlow Secure Signing',
      ].join('\\n'),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    // Do not log provider responses or signing URLs.
    throw new Error(
      `Signing invitation provider rejected request (${response.status})`,
    );
  }

  const result: unknown = await response.json();

  if (
    !result ||
    typeof result !== 'object' ||
    !('id' in result) ||
    typeof result.id !== 'string' ||
    !result.id
  ) {
    throw new Error('Invalid signing invitation provider response');
  }

  return {
    provider: 'resend',
    providerMessageId: result.id,
  };
}
