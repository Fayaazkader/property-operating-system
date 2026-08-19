// lib/suppliers/gl-learning.ts
// GL Allocation Learning Engine — learns entity-specific GL codes per supplier

import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface GLAllocationSuggestion {
  gl_code: string;
  gl_account_name?: string;
  confidence: number;
  times_used: number;
  source: 'learned' | 'prediction' | 'none';
}

// Normalize description for matching
function normalizeDescription(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Token-based similarity
function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(' '));
  const tokensB = new Set(b.split(' '));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  
  let matches = 0;
  for (const token of tokensA) {
    if (token.length > 2 && tokensB.has(token)) matches++;
  }
  
  return matches / Math.max(tokensA.size, tokensB.size);
}

// Check if GL code exists for entity
async function validateGlCode(
  entityId: string,
  glCode: string,
  db: SupabaseClient
): Promise<{ valid: boolean; account_name?: string }> {
  const { data } = await db
    .from('chart_of_accounts')
    .select('account_name')
    .eq('entity_id', entityId)
    .eq('gl_code', glCode)
    .single();
  
  return { valid: !!data, account_name: data?.account_name };
}

// Suggest GL code for a line item
export async function suggestGlCode(
  entityId: string,
  supplierId: string,
  description: string,
  propertyId?: string,
  db: SupabaseClient = supabase
): Promise<GLAllocationSuggestion> {
  const normalizedDesc = normalizeDescription(description);
  
  if (!normalizedDesc) {
    return { gl_code: '', confidence: 0, times_used: 0, source: 'none' };
  }
  
  // 1. Check learning table for exact or similar patterns
  const { data: learned } = await db
    .from('gl_allocation_learning')
    .select('*')
    .eq('entity_id', entityId)
    .eq('supplier_id', supplierId)
    .order('confidence', { ascending: false })
    .limit(20);
  
  if (learned?.length) {
    // Exact match first
    const exact = learned.find(record =>
      normalizeDescription(record.description_pattern) === normalizedDesc &&
      (propertyId ? record.property_id === propertyId : true)
    );
    
    if (exact) {
      const validation = await validateGlCode(entityId, exact.gl_code, db);
      if (validation.valid) {
        return {
          gl_code: exact.gl_code,
          gl_account_name: validation.account_name,
          confidence: exact.confidence,
          times_used: exact.times_used,
          source: 'learned',
        };
      }
    }
    
    // Similar match (token overlap > 60%)
    let bestSimilar: any = null;
    let bestScore = 0;
    
    for (const record of learned) {
      const recordDesc = normalizeDescription(record.description_pattern);
      const score = tokenSimilarity(normalizedDesc, recordDesc);
      
      if (score > 0.6 && score > bestScore) {
        if (propertyId && record.property_id && record.property_id !== propertyId) continue;
        bestSimilar = record;
        bestScore = score;
      }
    }
    
    if (bestSimilar) {
      const validation = await validateGlCode(entityId, bestSimilar.gl_code, db);
      if (validation.valid) {
        return {
          gl_code: bestSimilar.gl_code,
          gl_account_name: validation.account_name,
          confidence: Math.round(bestSimilar.confidence * bestScore),
          times_used: bestSimilar.times_used,
          source: 'learned',
        };
      }
    }
  }
  
  // 2. Fallback: generic prediction from entity's chart of accounts
  const { data: accounts } = await db
    .from('chart_of_accounts')
    .select('gl_code, account_name')
    .eq('entity_id', entityId)
    .eq('account_type', 'expense')
    .eq('is_active', true);
  
  if (accounts?.length) {
    // Find account whose name matches description keywords
    for (const acc of accounts) {
      const accName = acc.account_name.toLowerCase();
      const descTokens = normalizedDesc.split(' ');
      
      for (const token of descTokens) {
        if (token.length > 3 && accName.includes(token)) {
          return {
            gl_code: acc.gl_code,
            gl_account_name: acc.account_name,
            confidence: 40,
            times_used: 0,
            source: 'prediction',
          };
        }
      }
    }
  }
  
  return { gl_code: '', confidence: 0, times_used: 0, source: 'none' };
}

// Record the allocation after user confirms or changes
export async function recordGlAllocation(
  entityId: string,
  supplierId: string,
  description: string,
  glCode: string,
  taxCode: string,
  propertyId?: string,
  supplierAccountId?: string,
  db: SupabaseClient = supabase
): Promise<void> {
  const normalizedDesc = normalizeDescription(description);
  if (!normalizedDesc || !glCode) return;
  
  // Check if record exists
  const { data: existing } = await db
    .from('gl_allocation_learning')
    .select('*')
    .eq('entity_id', entityId)
    .eq('supplier_id', supplierId)
    .eq('description_pattern', normalizedDesc)
    .maybeSingle();
  
  if (existing) {
    // Update existing record
    if (existing.gl_code === glCode) {
      // Confirmed same allocation — increase confidence
      const newConfidence = Math.min(98, existing.confidence + 10);
      const newTimesUsed = existing.times_used + 1;
      
      await db
        .from('gl_allocation_learning')
        .update({
          confidence: newConfidence,
          times_used: newTimesUsed,
          last_used_at: new Date().toISOString(),
          property_id: propertyId || existing.property_id,
          supplier_account_id: supplierAccountId || existing.supplier_account_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // User changed GL — reset confidence, update code
      await db
        .from('gl_allocation_learning')
        .update({
          gl_code: glCode,
          tax_code: taxCode,
          confidence: 50,
          last_used_at: new Date().toISOString(),
          property_id: propertyId || existing.property_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    }
  } else {
    // Create new record
    await db
      .from('gl_allocation_learning')
      .insert({
        entity_id: entityId,
        supplier_id: supplierId,
        supplier_account_id: supplierAccountId || null,
        property_id: propertyId || null,
        description_pattern: normalizedDesc,
        gl_code: glCode,
        tax_code: taxCode,
        confidence: 50,
        times_used: 1,
        last_used_at: new Date().toISOString(),
      });
  }
}

// Get all learned allocations for a supplier (for UI display)
export async function getLearnedAllocations(
  entityId: string,
  supplierId: string,
  db: SupabaseClient = supabase
): Promise<any[]> {
  const { data } = await db
    .from('gl_allocation_learning')
    .select('*')
    .eq('entity_id', entityId)
    .eq('supplier_id', supplierId)
    .order('confidence', { ascending: false })
    .limit(20);
  
  return data || [];
}
