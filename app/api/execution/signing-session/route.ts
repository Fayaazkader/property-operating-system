import { readExecutionJson } from '@/lib/execution/server/request-body';
import { NextRequest, NextResponse } from 'next/server';
import { executionServiceClient } from '@/lib/execution/server/verification-api';
import { validateSigningInvitation } from '@/lib/execution/server/invitation-validation';

import { loadSigningFields } from '@/lib/execution/server/signing-fields';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if ((
    process.env.EXECUTION_PUBLIC_SIGNING_ENABLED !== 'true' ||
    process.env.EXECUTION_EMAIL_OTP_ENABLED !== 'true'
  )) {
    return NextResponse.json({ error: 'Signing unavailable' }, { status: 503 });
  }

  try {
    const body = await readExecutionJson(request,2048);
    const token = body && typeof body === 'object' && 'token' in body
      ? body.token : null;

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });
    }

    const client = executionServiceClient();
    const invitation = await validateSigningInvitation(client, token);

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation unavailable' }, { status: 404 });
    }

    const { data: participant, error } = await client
      .from('execution_participants')
      .select('name, participant_type, signing_order')
      .eq('id', invitation.participant_id)
      .eq('execution_id', invitation.execution_id)
      .maybeSingle();

    if (error || !participant) {
      return NextResponse.json({ error: 'Invitation unavailable' }, { status: 404 });
    }

    const manifest = await loadSigningFields(client, invitation);
    return NextResponse.json({
      fields: manifest.fields,
      manifestSha256: manifest.manifestSha256,
      participantName: participant.name,
      participantType: participant.participant_type,
      signingOrder: participant.signing_order,
      expiresAt: invitation.expires_at,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Signing unavailable' }, { status: 503 });
  }
}
