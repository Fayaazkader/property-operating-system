import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { participant_id, signature } = body;

    if (!participant_id || !signature) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get participant and execution
    const { data: participant, error: pError } = await supabaseAdmin
      .from('execution_participants')
      .select('*, execution:executions(*)')
      .eq('id', participant_id)
      .eq('execution_id', id)
      .single();

    if (pError || !participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    // Check if already signed
    if (participant.status === 'signed') {
      return NextResponse.json(
        { error: "Already signed" },
        { status: 400 }
      );
    }

    // Update participant status
    const { error: updateError } = await supabaseAdmin
      .from('execution_participants')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_data: { name: signature, method: 'typed' },
      })
      .eq('id', participant_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: "Failed to record signature" },
        { status: 500 }
      );
    }

    // Log event
    await supabaseAdmin
      .from('execution_events')
      .insert({
        execution_id: id,
        event_type: 'signed',
        event_data: { participant_id, participant_name: participant.name },
      });

    // Check if all participants have signed
    const { data: allParticipants } = await supabaseAdmin
      .from('execution_participants')
      .select('status')
      .eq('execution_id', id);

    const allSigned = allParticipants?.every(p => p.status === 'signed');

    if (allSigned) {
      // Update execution to executed
      const { error: execError } = await supabaseAdmin
        .from('executions')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (execError) {
        console.error('Execute error:', execError);
      } else {
        // Log executed event
        await supabaseAdmin
          .from('execution_events')
          .insert({
            execution_id: id,
            event_type: 'executed',
            event_data: { message: 'All parties have signed' },
          });
      }
    }

    return NextResponse.json({
      success: true,
      status: allSigned ? 'executed' : 'signed',
      message: allSigned ? 'All parties have signed. Lease executed!' : 'Signature recorded successfully.',
    });

  } catch (error) {
    console.error('Sign API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
