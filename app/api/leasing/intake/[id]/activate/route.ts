// app/api/leasing/intake/[id]/activate/route.ts
// Activation API Route — Thin wrapper around Activation Service

import { NextRequest, NextResponse } from "next/server";
import { leaseActivationService } from "@/lib/workflow/services/lease-activation-service";
import { supabase } from "@/lib/supabase";
import { permissionService } from "@/lib/rbac/permission-service";

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
        // Lease activation is the approval boundary.
    // The user must have leases.approve for this entity.
    const { data: intake, error: intakeError } = await supabase
  .from("lease_intake")
  .select("*")
  .eq("id", id)
  .single();

    if (intakeError || !intake?.entity_id) {
      return NextResponse.json(
        { error: "Lease intake or entity could not be determined." },
        { status: 404 }
      );
    }

    const permission = await permissionService.can(
      user.id,
      intake.entity_id,
      "leases.approve"
    );

    if (!permission.allowed) {
      return NextResponse.json(
        { error: "You do not have permission to approve and activate leases." },
        { status: 403 }
      );
    }

    // Canonical activation workflow.
// The intake is an entry point into the same activation system
// used by the manual/OCR tenant creation workflow.

const result = await leaseActivationService.execute({
  entityId: intake.entity_id,
  tenantName: intake.applicant_name,
  companyRegistration: intake.company_registration,
  vatNumber: intake.vat_number,
  email: intake.email,
  phone: intake.phone,
  propertyId: intake.property_id,
  unitId: intake.unit_id,
  monthlyRental: Number(intake.monthly_rental || 0),
  leaseStartDate: intake.commencement_date,
  leaseEndDate: intake.expiry_date,
  escalationPercent: Number(intake.escalation_percent || 8),
  depositAmount: Number(intake.deposit_amount || intake.monthly_rental || 0),
  parkingBays: Number(intake.parking_bays || 0),
  parkingRate: Number(intake.parking_rate || 850),
});

return NextResponse.json({
  success: true,
  lease_id: result.leaseId,
  tenant_id: result.tenantId,
  lease_ref: result.leaseRef,
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
