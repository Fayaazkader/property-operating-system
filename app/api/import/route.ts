import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // 1. First, parse the request body to get entityId
    const { target, rows, entityId } = await req.json();
    
    console.log('Target:', target);
    console.log('Rows received:', rows?.length);
    console.log('Entity ID from request:', entityId);
    
    if (!target || !rows || rows.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // 2. Create a client that reads the session from cookies
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // 3. Get the logged-in user from the session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('User found:', user.email);
    
    // 4. Verify the user has access to the requested entity
    const { data: userEntity, error: entityError } = await supabase
      .from('user_entities')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_id', entityId)
      .single();

    if (entityError || !userEntity) {
      console.log('Entity error:', entityError);
      return NextResponse.json({ error: 'User does not have access to this entity' }, { status: 403 });
    }

    // Use entity from request, or fallback to default
    const entityIdToUse = entityId || '00000000-0000-0000-0000-000000000101';
    console.log('Using entity ID:', entityIdToUse);
    
    // 5. For actual data operations, use service role key (bypasses RLS)
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const allowedTargets = ['properties', 'tenants', 'leases'];
    if (!allowedTargets.includes(target)) {
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
    }

    let rowsWithEntity;
    if (target === 'properties') {
      rowsWithEntity = rows.map((row: any) => ({
        property_name: row.name || row.property_name,
        address_line_1: row.address || row.address_line_1,
        city: row.city,
        province: row.state || row.province,
        postal_code: row.postal_code || row.postal_code,
        total_gla_sqm: row.gla_sqft ? parseFloat(row.gla_sqft) : (row.total_gla_sqm || null),
        entity_id: entityIdToUse,
      }));
    } else if (target === 'tenants') {
      rowsWithEntity = rows.map((row: any) => ({
        tenant_name: row.name || row.tenant_name,
        email: row.email,
        phone: row.phone,
        company_registration: row.company_registration || null,
        vat_number: row.vat_number || null,
        industry: row.industry || null,
        entity_id: entityIdToUse,
      }));
    } else if (target === 'leases') {
      return await handleLeaseImport(serviceSupabase, rows, entityIdToUse);
    }

    const BATCH_SIZE = 500;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rowsWithEntity.length; i += BATCH_SIZE) {
      const batch = rowsWithEntity.slice(i, i + BATCH_SIZE);
      
      const validBatch = batch.filter((row: any) => {
        if (target === 'properties' && !row.property_name) return false;
        if (target === 'tenants' && !row.tenant_name) return false;
        return true;
      });

      if (validBatch.length === 0) {
        failed += batch.length;
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: All rows skipped.`);
        continue;
      }

      const { data, error } = await serviceSupabase
        .from(target)
        .insert(validBatch)
        .select();

      if (error) {
        failed += validBatch.length;
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        succeeded += (data?.length || validBatch.length);
      }
    }

    return NextResponse.json({
      total: rows.length,
      succeeded,
      failed,
      errors: errors.slice(0, 20),
    });

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleLeaseImport(supabase: any, rows: any[], entityId: string) {
  const BATCH_SIZE = 200;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  const { data: properties } = await supabase
    .from('properties')
    .select('id, property_name')
    .eq('entity_id', entityId);
  const propMap = Object.fromEntries((properties || []).map((p: any) => [p.property_name?.toLowerCase(), p.id]));

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, tenant_name')
    .eq('entity_id', entityId);
  const tenantMap = Object.fromEntries((tenants || []).map((t: any) => [t.tenant_name?.toLowerCase(), t.id]));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const resolvedBatch: any[] = [];

    for (const row of batch) {
      const propName = (row.property_name || '').toLowerCase();
      const tenantName = (row.tenant_name || '').toLowerCase();
      const propertyId = propMap[propName];
      const tenantId = tenantMap[tenantName];

      if (!propertyId) {
        errors.push(`Row ${i + 1}: Property "${row.property_name}" not found.`);
        failed++;
        continue;
      }
      if (!tenantId) {
        errors.push(`Row ${i + 1}: Tenant "${row.tenant_name}" not found.`);
        failed++;
        continue;
      }
      if (!row.monthly_rental || !row.commencement_date) {
        errors.push(`Row ${i + 1}: Missing monthly_rental or commencement_date.`);
        failed++;
        continue;
      }

      const leaseNumber = row.lease_id || `LS-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      resolvedBatch.push({
        client_id: tenantId,
        lease_id: leaseNumber,
        property_id: propertyId,
        tenant_id: tenantId,
        property_name: row.property_name,
        tenant_name: row.tenant_name,
        unit_number: row.unit_number || null,
        gla_sqm: row.gla_sqm ? parseFloat(row.gla_sqm) : null,
        monthly_rental: parseFloat(row.monthly_rental),
        lease_start_date: row.commencement_date,
        lease_end_date: row.expiry_date || null,
        lease_status: row.lease_status || 'Active',
        owner_entity_id: entityId,
        managing_entity_id: entityId,
      });
    }

    if (resolvedBatch.length === 0) continue;

    const { data, error } = await supabase
      .from('leases')
      .insert(resolvedBatch)
      .select();

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      failed += resolvedBatch.length;
    } else {
      succeeded += (data?.length || resolvedBatch.length);
    }
  }

  return NextResponse.json({
    total: rows.length,
    succeeded,
    failed,
    errors: errors.slice(0, 20),
  });
}