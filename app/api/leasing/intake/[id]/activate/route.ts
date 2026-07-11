// app/api/leasing/intake/[id]/activate/route.ts
// API route for lease activation
// Calls the Workflow Orchestrator

import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/conversation/workflow-orchestrator";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: "Intake ID required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const result = await orchestrator.execute("lease_activation", {
      intakeId: id,
      initiated_by: user?.id || "system"
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
