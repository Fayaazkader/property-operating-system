import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // TEMPORARY: Hardcode for testing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dWFtcW5lZmV4dnZyaWRrZGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI2MzA3OCwiZXhwIjoyMDk0ODM5MDc4fQ._hud3Ebxc69lfv2hrwQm9d_GoLcTqT6gdzcSJXEd_2c'  // <-- Quotes added
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
    property_name: row.property_name,
    address_line_1: row.address_line_1,
    city: row.city,
    province: row.province,
    postal_code: row.postal_code,
    total_gla_sqm: row.total_gla_sqm ? parseFloat(row.total_gla_sqm) : null,
    entity_id: entityId,
  }));
} else if (target === 'tenants') {
  rowsWithEntity = rows.map((row: any) => ({
    tenant_name: row.tenant_name,
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

    console.log('Rows with entity length:', rowsWithEntity.length);
    console.log('First row with entity:', rowsWithEntity[0]);

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
      console.log('First valid row:', validBatch[0]);

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
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
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

  console.log('=== LEASE IMPORT DEBUG ===');
  console.log('Properties in DB:', Object.keys(propMap));
  console.log('Tenants in DB:', Object.keys(tenantMap));
  console.log('Rows received:', rows.length);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const resolvedBatch: any[] = [];

    for (const row of batch) {
      console.log('Processing row:', row);
      
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
      
      // Check for required fields (handle both original and mapped column names)
      const monthlyRental = row.base_rent || row.monthly_rental;
      const commencementDate = row.start_date || row.commencement_date;
      
      if (!monthlyRental || !commencementDate) {
        errors.push(`Row ${i + 1}: Missing monthly_rental or commencement_date. Skipped.`);
        failed++;
        continue;
      }

      const leaseNumber = row.lease_number || row.lease_id || `LS-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      // Get unit number (handle both column names)
      const unitNumber = row.unit || row.unit_number || null;
      
      // Get GLA (handle both column names)
      const gla = row.gla_sqft || row.gla_sqm || null;

      resolvedBatch.push({
        client_id: tenantId,
        lease_id: leaseNumber,
        property_id: propertyId,
        tenant_id: tenantId,
        property_name: row.property_name,
        tenant_name: row.tenant_name,
        unit_number: unitNumber,
        gla_sqm: gla ? parseFloat(gla) : null,
        monthly_rental: parseFloat(monthlyRental),
        commencement_date: new Date(commencementDate).toISOString(),
        expiry_date: row.end_date || row.expiry_date ? new Date(row.end_date || row.expiry_date).toISOString() : null,
        lease_status: row.status || row.lease_status || 'Active',
        managing_entity_id: entityId,
      });
    }

    if (resolvedBatch.length === 0) continue;

    console.log(`Batch ${i / BATCH_SIZE + 1}: Inserting ${resolvedBatch.length} leases`);
    
    const { data, error } = await supabase
      .from('leases')
      .insert(resolvedBatch)
      .select();

    if (error) {
      errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error.message}`);
      failed += resolvedBatch.length;
      console.error('Insert error:', error);
    } else {
      succeeded += resolvedBatch.length;
      console.log(`Inserted ${data?.length} leases`);
    }
  }

  return NextResponse.json({
    total: rows.length,
    succeeded,
    failed,
    errors: errors.slice(0, 20),
  });
}