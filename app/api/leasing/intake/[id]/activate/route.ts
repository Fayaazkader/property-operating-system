import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    console.log('=== ACTIVATION API ===');
    console.log('Intake ID:', id);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required", details: "No token provided" },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User error:', userError);
      return NextResponse.json(
        { error: "Authentication required", details: userError?.message || "Invalid token" },
        { status: 401 }
      );
    }

    console.log('✅ User:', user.email);

    const { data: intake, error: intakeError } = await supabase
      .from("lease_intake")
      .select("*")
      .eq("id", id)
      .single();

    if (intakeError || !intake) {
      console.error('Intake fetch error:', intakeError);
      return NextResponse.json(
        { error: "Intake not found", details: intakeError?.message },
        { status: 404 }
      );
    }

    console.log('Found intake:', intake.id, 'Status:', intake.status);

    if (intake.status === 'activated') {
      return NextResponse.json({
        success: true,
        message: 'Already activated'
      });
    }

    // Validate required fields
    const missing: string[] = [];
    if (!intake.monthly_rental) missing.push('monthly_rental');
    if (!intake.tenant_id) missing.push('tenant_id');
    if (!intake.property_id) missing.push('property_id');
    if (!intake.unit_id) missing.push('unit_id');

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("entity_id, tenant_name")
      .eq("id", intake.tenant_id)
      .single();

    // Generate unique IDs
    const timestamp = Date.now();
    const clientId = `CLIENT-${timestamp}`;
    const leaseId = `LEASE-${timestamp}`;

    console.log('Creating lease with client_id:', clientId, 'lease_id:', leaseId);

    // Create lease with all required fields
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .insert({
        client_id: clientId,
        lease_id: leaseId,
        tenant_id: intake.tenant_id,
        property_id: intake.property_id,
        unit_id: intake.unit_id,
        monthly_rental: intake.monthly_rental,
        deposit_amount: intake.deposit_amount,
        commencement_date: intake.commencement_date,
        expiry_date: intake.expiry_date,
        escalation_percent: intake.escalation_percent || 0,
        parking_bays: intake.parking_bays || 0,
        lease_status: 'executed',
        owner_entity_id: tenant?.entity_id || intake.entity_id,
        managing_entity_id: tenant?.entity_id || intake.entity_id,
        tenant_name: intake.applicant_name,
        company_registration: intake.company_registration || '',
        lease_start_date: intake.commencement_date,
        lease_end_date: intake.expiry_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (leaseError) {
      console.error('Lease creation error:', leaseError);
      return NextResponse.json(
        { error: "Failed to create lease", details: leaseError.message },
        { status: 500 }
      );
    }

    console.log('✅ Lease created:', lease.id);

    // Update intake status
    const { error: updateError } = await supabase
      .from("lease_intake")
      .update({ 
        status: "activated",
        activated_at: new Date().toISOString(),
        lease_id: lease.id
      })
      .eq("id", id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: "Failed to update status", details: updateError.message },
        { status: 500 }
      );
    }

    console.log('✅ Status updated to activated');

    // Update unit occupancy
    if (intake.unit_id) {
      await supabase
        .from("units")
        .update({
          occupancy_status: "occupied",
          current_tenant_name: intake.applicant_name,
          current_lease_id: lease.id,
          current_rental_rate: intake.monthly_rental,
          updated_at: new Date().toISOString()
        })
        .eq("id", intake.unit_id);
      console.log('✅ Unit updated');
    }

    return NextResponse.json({
      success: true,
      lease_id: lease.id,
      intake_id: id,
      status: "activated",
      message: "Lease activated successfully"
    });

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
