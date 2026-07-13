import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { participant_id, signature } = body;

    console.log('=== SIGN API CALLED ===');
    console.log('Execution ID:', id);
    console.log('Participant ID:', participant_id);
    console.log('Signature:', signature?.substring(0, 20) + '...');

    if (!participant_id || !signature) {
      console.log('Missing required fields');
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if execution exists
    const { data: execution, error: execError } = await supabaseAdmin
      .from('executions')
      .select('*')
      .eq('id', id)
      .single();

    if (execError || !execution) {
      console.log('Execution not found:', execError);
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }

    console.log('Execution status:', execution.status);

    // Check if execution is already executed
    if (execution.status === 'executed' || execution.status === 'activated') {
      console.log('Execution already completed');
      return NextResponse.json(
        { error: "Execution already completed" },
        { status: 400 }
      );
    }

    // Get participant
    const { data: participant, error: pError } = await supabaseAdmin
      .from('execution_participants')
      .select('*')
      .eq('id', participant_id)
      .eq('execution_id', id)
      .single();

    if (pError || !participant) {
      console.log('Participant not found:', pError);
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    console.log('Participant:', participant.name, 'Status:', participant.status);

    if (participant.status === 'signed') {
      return NextResponse.json(
        { error: "Already signed" },
        { status: 400 }
      );
    }

    // Update participant
    console.log('Updating participant...');
    const { error: updateError } = await supabaseAdmin
      .from('execution_participants')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_data: { name: signature, method: 'typed' },
      })
      .eq('id', participant_id);

    if (updateError) {
      console.log('Update error:', updateError);
      return NextResponse.json(
        { error: "Failed to record signature", details: updateError.message },
        { status: 500 }
      );
    }

    console.log('Participant updated');

    // Log event
    const { error: eventError } = await supabaseAdmin
      .from('execution_events')
      .insert({
        execution_id: id,
        event_type: 'signed',
        event_data: { participant_id, participant_name: participant.name },
      });

    if (eventError) {
      console.log('Event log error:', eventError);
    }

    // Check if all participants signed
    const { data: allParticipants, error: countError } = await supabaseAdmin
      .from('execution_participants')
      .select('status')
      .eq('execution_id', id);

    if (countError) {
      console.log('Count error:', countError);
    }

    const allSigned = allParticipants?.every(p => p.status === 'signed');
    console.log('All signed?', allSigned);

    if (allSigned) {
      console.log('All participants signed! Executing...');
      const { error: execUpdateError } = await supabaseAdmin
        .from('executions')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (execUpdateError) {
        console.log('Execute error:', execUpdateError);
      } else {
        console.log('Execution updated to executed');
      }

      await supabaseAdmin
        .from('execution_events')
        .insert({
          execution_id: id,
          event_type: 'executed',
          event_data: { message: 'All parties have signed' },
        });
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
