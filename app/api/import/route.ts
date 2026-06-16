import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { target, rows } = await req.json();
    
    console.log('=== IMPORT DEBUG ===');
    console.log('Target:', target);
    console.log('Rows received:', rows?.length);
    console.log('First row:', rows?.[0]);
    
    if (!target || !rows || rows.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const allowedTargets = ['properties', 'tenants', 'leases'];
    if (!allowedTargets.includes(target)) {
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
    }

    const entityId = '00000000-0000-0000-0000-000000000101';

    let rowsWithEntity;
    if (target === 'properties') {
      rowsWithEntity = rows.map((row: any) => ({
        property_name: row.name,
        address_line_1: row.address,
        city: row.city,
        province: row.state,
        postal_code: row.postal_code,
        total_gla_sqm: row.gla_sqft ? parseFloat(row.gla_sqft) : null,
        entity_id: entityId,
      }));
    } else if (target === 'tenants') {
      rowsWithEntity = rows.map((row: any) => ({
        tenant_name: row.name,
        email: row.email,
        phone: row.phone,
        entity_id: entityId,
      }));
    } else if (target === 'leases') {
      rowsWithEntity = rows.map((row: any) => ({
        ...row,
        entity_id: entityId,
      }));
    }

    const BATCH_SIZE = 500;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    if (target === 'leases') {
      return await handleLeaseImport(supabase, rowsWithEntity, entityId);
    }

    for (let i = 0; i < rowsWithEntity.length; i += BATCH_SIZE) {
      const batch = rowsWithEntity.slice(i, i + BATCH_SIZE);
      
      const validBatch = batch.filter((row: any) => {
        if (target === 'properties' && !row.property_name) return false;
        if (target === 'tenants' && !row.tenant_name) return false;
        return true;
      });

      console.log(`Batch ${i / BATCH_SIZE + 1}: ${validBatch.length} valid rows`);

      if (validBatch.length === 0) {
        failed += batch.length;
        errors.push(`Batch ${i / BATCH_SIZE + 1}: All rows skipped.`);
        continue;
      }

      const { data, error } = await supabase
        .from(target)
        .insert(validBatch)
        .select();

      if (error) {
        failed += validBatch.length;
        errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error.message}`);
        console.error('Insert error:', error);
      } else {
        succeeded += validBatch.length;
        console.log(`Inserted ${data?.length} rows`);
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
  const propMap = Object.fromEntries((properties || []).map((p: any) => [p.property_name, p.id]));

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, tenant_name')
    .eq('entity_id', entityId);
  const tenantMap = Object.fromEntries((tenants || []).map((t: any) => [t.tenant_name, t.id]));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const resolvedBatch: any[] = [];

    for (const row of batch) {
      const propertyId = propMap[row.property_name];
      const tenantId = tenantMap[row.tenant_name];

      if (!propertyId) {
        errors.push(`Row ${i + 1}: Property "${row.property_name}" not found. Skipped.`);
        failed++;
        continue;
      }
      if (!tenantId) {
        errors.push(`Row ${i + 1}: Tenant "${row.tenant_name}" not found. Skipped.`);
        failed++;
        continue;
      }
      if (!row.base_rent || !row.start_date) {
        errors.push(`Row ${i + 1}: Missing base_rent or start_date. Skipped.`);
        failed++;
        continue;
      }

      const leaseNumber = row.lease_number || `LS-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      resolvedBatch.push({
  client_id: tenantId,  // Use the tenant ID as client_id
  lease_id: leaseNumber,
  property_id: propertyId,
  tenant_id: tenantId,
  property_name: row.property_name,
  tenant_name: row.tenant_name,
  unit_number: row.unit || null,
  gla_sqm: row.gla_sqft ? parseFloat(row.gla_sqft) : null,
  monthly_rental: parseFloat(row.base_rent),
  commencement_date: new Date(row.start_date).toISOString(),
  expiry_date: row.end_date ? new Date(row.end_date).toISOString() : null,
  lease_status: row.status || 'Active',
  managing_entity_id: entityId,
});
    }

    if (resolvedBatch.length === 0) continue;

    const { data, error } = await supabase
      .from('leases')
      .insert(resolvedBatch)
      .select();

    if (error) {
      errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error.message}`);
      failed += resolvedBatch.length;
    } else {
      succeeded += resolvedBatch.length;
    }
  }

  return NextResponse.json({
    total: rows.length,
    succeeded,
    failed,
    errors: errors.slice(0, 20),
  });
}