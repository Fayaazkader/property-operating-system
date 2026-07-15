// app/api/leasing/intake/[id]/activate/route.ts
// Activation API Route — Thin wrapper around Activation Service

import { NextRequest, NextResponse } from "next/server";
import { activationService } from "@/lib/services/activation.service";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json(
        { error: "Intake ID required" },
        { status: 400 }
      );
    }

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required", details: userError?.message },
        { status: 401 }
      );
    }

    // Use the service to activate
    const result = await activationService.activate(id, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Activation failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      lease_id: result.leaseId,
      intake_id: result.intakeId,
      status: "activated",
      message: "Lease activated successfully",
    });

  } catch (error) {
    console.error("Activation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
