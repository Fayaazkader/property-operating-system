import 'server-only';

export interface VerificationEmailInput {
  destination: string;
  code: string;
}

export async function sendVerificationEmail(
  input: VerificationEmailInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EXECUTION_VERIFICATION_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error('Verification email provider is not configured');
  }

  if (!/^[0-9]{6}$/.test(input.code)) {
    throw new Error('Invalid verification code');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.destination],
      subject: 'Your AssetFlow signing verification code',
      text: [
        'AssetFlow Secure Signing',
        '',
        `Your verification code is: ${input.code}`,
        '',
        'This code expires in 5 minutes.',
        'Do not share this code with anyone.',
        '',
        'If you did not request this code, you can ignore this email.',
      ].join('\n'),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    // Never log provider responses containing sensitive information.
    throw new Error(
      `Verification email delivery failed (${response.status})`,
    );
  }

  const result: unknown = await response.json();

  if (
    !result ||
    typeof result !== 'object' ||
    !('id' in result) ||
    typeof result.id !== 'string'
  ) {
    throw new Error('Verification email provider returned an invalid response');
  }
}
