import { NextRequest, NextResponse } from "next/server";
import { createExecutionEngine } from "@/lib/execution";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { participant_id, signature, signature_method } = body;

    if (!participant_id || !signature) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get IP and user agent from request
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const timezone = body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Create execution engine instance
    const engine = createExecutionEngine(supabase, {
      userId: body.user_id,
      ipAddress: ipAddress as string,
      userAgent: userAgent as string,
    });

    // Use the engine to record the signature
    const result = await engine.sign({
      executionId: id,
      participantId: participant_id,
      signature: signature,
      signatureMethod: signature_method || 'typed',
      ipAddress: ipAddress as string,
      userAgent: userAgent as string,
      timezone: timezone,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors?.[0] || "Failed to record signature" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      message: result.message,
      signed_at: result.data?.participant?.signed_at,
    });

  } catch (error) {
    console.error('Sign API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
