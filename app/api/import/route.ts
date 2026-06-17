import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { target, rows } = await req.json();
    
    if (!target || !rows || rows.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const allowedTargets = ['properties', 'tenants', 'leases'];
    if (!allowedTargets.includes(target)) {
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
    }

    const entityId = '00000000-0000-0000-0000-000000000101';

    // ===== DUPLICATE DETECTION =====
    const duplicates: any[] = [];
    const uniqueRows: any[] = [];
    const duplicateErrors: string[] = [];

    // Check for duplicates based on target
    if (target === 'properties') {
      const { data: existing } = await supabase
        .from('properties')
        .select('property_name')
        .eq('entity_id', entityId);
      const existingNames = new Set((existing || []).map((p: any) => p.property_name?.toLowerCase()));
      
      rows.forEach((row: any) => {
        const name = row.name || row.property_name;
        if (name && existingNames.has(name.toLowerCase())) {
          duplicates.push(row);
          duplicateErrors.push(`Property "${name}" already exists`);
        } else {
          uniqueRows.push(row);
        }
      });
    } else if (target === 'tenants') {
      const { data: existing } = await supabase
        .from('tenants')
        .select('tenant_name')
        .eq('entity_id', entityId);
      const existingNames = new Set((existing || []).map((t: any) => t.tenant_name?.toLowerCase()));
      
      rows.forEach((row: any) => {
        const name = row.name || row.tenant_name;
        if (name && existingNames.has(name.toLowerCase())) {
          duplicates.push(row);
          duplicateErrors.push(`Tenant "${name}" already exists`);
        } else {
          uniqueRows.push(row);
        }
      });
    } else if (target === 'leases') {
      const { data: existing } = await supabase
        .from('leases')
        .select('lease_id')
        .eq('managing_entity_id', entityId);
      const existingIds = new Set((existing || []).map((l: any) => l.lease_id?.toLowerCase()));
      
      rows.forEach((row: any) => {
        const id = row.lease_id || row.lease_number;
        if (id && existingIds.has(id.toLowerCase())) {
          duplicates.push(row);
          duplicateErrors.push(`Lease "${id}" already exists`);
        } else {
          uniqueRows.push(row);
        }
      });
    }

    // Use unique rows for import
    const rowsToImport = uniqueRows.length > 0 ? uniqueRows : rows;

    // ===== BUILD ROWS WITH ENTITY =====
    let rowsWithEntity;
    if (target === 'properties') {
      rowsWithEntity = rowsToImport.map((row: any) => ({
        property_name: row.name || row.property_name,
        address_line_1: row.address || row.address_line_1,
        city: row.city,
        province: row.state || row.province,
        postal_code: row.postal_code || row.postal_code,
        total_gla_sqm: row.gla_sqft ? parseFloat(row.gla_sqft) : (row.total_gla_sqm || null),
        entity_id: entityId,
      }));
    } else if (target === 'tenants') {
      rowsWithEntity = rowsToImport.map((row: any) => ({
        tenant_name: row.name || row.tenant_name,
        email: row.email,
        phone: row.phone,
        company_registration: row.company_registration || null,
        vat_number: row.vat_number || null,
        industry: row.industry || null,
        entity_id: entityId,
      }));
    } else if (target === 'leases') {
      return await handleLeaseImport(supabase, rowsToImport, entityId, duplicates, duplicateErrors);
    }

    // ===== IMPORT UNIQUE ROWS =====
    const BATCH_SIZE = 500;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];
    const failedRows: any[] = [];

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
        // Store failed rows
        batch.forEach((row: any) => {
          failedRows.push({ row, error: 'Missing required fields' });
        });
        continue;
      }

      const { data, error } = await supabase
        .from(target)
        .insert(validBatch)
        .select();

      if (error) {
        failed += validBatch.length;
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        // Store failed rows
        validBatch.forEach((row: any) => {
          failedRows.push({ row, error: error.message });
        });
      } else {
        succeeded += (data?.length || validBatch.length);
      }
    }

    // ===== BUILD RESPONSE =====
    const response: any = {
      total: rows.length,
      succeeded,
      failed,
      errors: errors.slice(0, 20),
    };

    // Add duplicate info if duplicates found
    if (duplicates.length > 0) {
      response.duplicates = {
        count: duplicates.length,
        items: duplicates,
        errors: duplicateErrors,
        message: `${duplicates.length} duplicate(s) found and skipped`
      };
    }

    // Add error CSV data if there are failed rows
    if (failedRows.length > 0 || errors.length > 0) {
      response.errorRows = failedRows.map((fr: any) => ({
        ...fr.row,
        _error: fr.error
      }));
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleLeaseImport(supabase: any, rows: any[], entityId: string, duplicates: any[] = [], duplicateErrors: string[] = []) {
  const BATCH_SIZE = 200;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];
  const failedRows: any[] = [];

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
        const err = `Property "${row.property_name}" not found.`;
        errors.push(`Row ${i + 1}: ${err}`);
        failed++;
        failedRows.push({ ...row, _error: err });
        continue;
      }
      if (!tenantId) {
        const err = `Tenant "${row.tenant_name}" not found.`;
        errors.push(`Row ${i + 1}: ${err}`);
        failed++;
        failedRows.push({ ...row, _error: err });
        continue;
      }
      if (!row.monthly_rental || !row.commencement_date) {
        const err = 'Missing monthly_rental or commencement_date.';
        errors.push(`Row ${i + 1}: ${err}`);
        failed++;
        failedRows.push({ ...row, _error: err });
        continue;
      }

      const leaseNumber = row.lease_id || `LS-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      resolvedBatch.push({
        client_id: "C001",
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
      resolvedBatch.forEach((row: any) => {
        failedRows.push({ ...row, _error: error.message });
      });
    } else {
      succeeded += (data?.length || resolvedBatch.length);
    }
  }

  const response: any = {
    total: rows.length + duplicates.length,
    succeeded,
    failed,
    errors: errors.slice(0, 20),
  };

  if (duplicates.length > 0) {
    response.duplicates = {
      count: duplicates.length,
      items: duplicates,
      errors: duplicateErrors,
      message: `${duplicates.length} duplicate(s) found and skipped`
    };
  }

  if (failedRows.length > 0) {
    response.errorRows = failedRows.map((fr: any) => {
      const { _error, ...rest } = fr;
      return { ...rest, _error };
    });
  }

  return NextResponse.json(response);
}