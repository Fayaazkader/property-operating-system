import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/conversation/workflow-orchestrator";
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

    // Get current user for audit
    const { data: { user } } = await supabase.auth.getUser();

    // First, fetch the intake to pass through
    const { data: intake } = await supabase
      .from("lease_intake")
      .select("*")
      .eq("id", id)
      .single();

    const result = await orchestrator.execute("lease_activation", {
      intakeId: id,
      initiated_by: user?.id || "system",
      intake: intake // Pass the full intake data
    });

    if (!result.success) {
      const failedStep = result.results.find(r => !r.success);
      return NextResponse.json(
        { 
          error: "Activation failed",
          step: failedStep?.step,
          message: failedStep?.error?.message || "Unknown error",
          details: failedStep?.error?.details || null
        },
        { status: 400 }
      );
    }

    const leaseData = result.results.find(r => r.data?.lease);
    
    return NextResponse.json({
      success: true,
      workflow_id: "lease_activation",
      lease_id: leaseData?.data?.lease?.id,
      intake_id: id,
      events_published: ["lease.activated"],
      warnings: result.results.flatMap(r => r.data?.intake?.warnings || [])
    });
  } catch (error) {
    console.error("Activation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
