import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    console.log('=== PRECHECK API CALLED ===');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { target, rows, entityId } = await req.json();
    
    console.log('Precheck - Target:', target);
    console.log('Precheck - Rows received:', rows?.length);
    
    if (!target || !rows || rows.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Use hardcoded entity ID for testing
    const entityIdToUse = entityId || '00000000-0000-0000-0000-000000000101';
    
    const duplicateIndices: number[] = [];
    const existingValues: string[] = [];

    if (target === 'properties') {
      const { data: existing } = await supabase
        .from('properties')
        .select('property_name')
        .eq('entity_id', entityId);
      const existingNames = new Set((existing || []).map((p: any) => p.property_name?.toLowerCase()));
      
      console.log('Existing properties in DB:', existingNames.size);
      
      rows.forEach((row: any, index: number) => {
        const name = row.name || row.property_name;
        if (name && existingNames.has(name.toLowerCase())) {
          duplicateIndices.push(index);
          existingValues.push(name);
        }
      });
    } else if (target === 'tenants') {
      const { data: existing } = await supabase
        .from('tenants')
        .select('tenant_name')
        .eq('entity_id', entityId);
      const existingNames = new Set((existing || []).map((t: any) => t.tenant_name?.toLowerCase()));
      
      console.log('Existing tenants in DB:', existingNames.size);
      
      rows.forEach((row: any, index: number) => {
        const name = row.name || row.tenant_name;
        if (name && existingNames.has(name.toLowerCase())) {
          duplicateIndices.push(index);
          existingValues.push(name);
        }
      });
    } else if (target === 'leases') {
      const { data: existing } = await supabase
        .from('leases')
        .select('lease_id')
        .eq('managing_entity_id', entityId);
      const existingIds = new Set((existing || []).map((l: any) => l.lease_id?.toLowerCase()));
      
      console.log('Existing leases in DB:', existingIds.size);
      
      rows.forEach((row: any, index: number) => {
        const id = row.lease_id || row.lease_number;
        if (id && existingIds.has(id.toLowerCase())) {
          duplicateIndices.push(index);
          existingValues.push(id);
        }
      });
    }

    console.log('Duplicate indices found:', duplicateIndices);
    console.log('Duplicate count:', duplicateIndices.length);

    return NextResponse.json({
      duplicateIndices,
      duplicateCount: duplicateIndices.length,
      existingValues,
      message: duplicateIndices.length > 0 
        ? `${duplicateIndices.length} duplicate(s) found in the database`
        : 'No duplicates found'
    });

  } catch (error: any) {
    console.error('Precheck error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}