// lib/suppliers/gl-learning.ts
// GL Allocation Learning Engine — server-side intelligence service
// All functions require a SupabaseClient. No browser defaults.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface GLAllocationSuggestion {
  gl_code: string;
  gl_account_name?: string;
  confidence: number;
  times_used: number;
  source: 'learned' | 'similar' | 'prediction' | 'none';
}

function normalizeDescription(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

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

function getConfidenceForUses(timesUsed: number): number {
  if (timesUsed >= 5) return 98;
  if (timesUsed >= 4) return 95;
  if (timesUsed >= 3) return 90;
  if (timesUsed >= 2) return 75;
  return 50;
}

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

export async function suggestGlCode(
  entityId: string,
  supplierId: string,
  description: string,
  db: SupabaseClient,
  propertyId?: string
): Promise<GLAllocationSuggestion> {
  const normalizedDesc = normalizeDescription(description);
  if (!normalizedDesc) return { gl_code: '', confidence: 0, times_used: 0, source: 'none' };

  // 1. Exact learned match
  const { data: exactMatch } = await db
    .from('gl_allocation_learning')
    .select('*')
    .eq('entity_id', entityId)
    .eq('supplier_id', supplierId)
    .eq('description_pattern', normalizedDesc)
    .maybeSingle();

  if (exactMatch) {
    const validation = await validateGlCode(entityId, exactMatch.gl_code, db);
    if (validation.valid) {
      return {
        gl_code: exactMatch.gl_code,
        gl_account_name: validation.account_name,
        confidence: exactMatch.confidence,
        times_used: exactMatch.times_used,
        source: 'learned',
      };
    }
  }

  // 2. Similar learned match
  const { data: learned } = await db
    .from('gl_allocation_learning')
    .select('*')
    .eq('entity_id', entityId)
    .eq('supplier_id', supplierId)
    .order('confidence', { ascending: false })
    .limit(20);

  if (learned?.length) {
    let bestSimilar: any = null;
    let bestScore = 0;

    for (const record of learned) {
      if (propertyId && record.property_id && record.property_id !== propertyId) continue;
      const recordDesc = normalizeDescription(record.description_pattern);
      const score = tokenSimilarity(normalizedDesc, recordDesc);
      if (score > 0.6 && score > bestScore) {
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
          source: 'similar',
        };
      }
    }
  }

  // 3. Supplier historical allocation (most common GL for this supplier)
  if (learned?.length) {
    const glCounts: Record<string, number> = {};
    for (const record of learned) {
      glCounts[record.gl_code] = (glCounts[record.gl_code] || 0) + record.times_used;
    }
    const mostCommon = Object.entries(glCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon) {
      const validation = await validateGlCode(entityId, mostCommon[0], db);
      if (validation.valid) {
        return {
          gl_code: mostCommon[0],
          gl_account_name: validation.account_name,
          confidence: 50,
          times_used: mostCommon[1],
          source: 'prediction',
        };
      }
    }
  }

  // 4. Generic prediction from entity chart of accounts
  const { data: accounts } = await db
    .from('chart_of_accounts')
    .select('gl_code, account_name')
    .eq('entity_id', entityId)
    .eq('account_type', 'expense')
    .eq('is_active', true);

  if (accounts?.length) {
    for (const acc of accounts) {
      const accName = acc.account_name.toLowerCase();
      for (const token of normalizedDesc.split(' ')) {
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

export async function recordGlAllocation(
  entityId: string,
  supplierId: string,
  description: string,
  glCode: string,
  taxCode: string,
  db: SupabaseClient,
  propertyId?: string,
  supplierAccountId?: string
): Promise<void> {
  const normalizedDesc = normalizeDescription(description);
  if (!normalizedDesc || !glCode) return;

  const { data: existing } = await db
    .from('gl_allocation_learning')
    .select('*')
    .eq('entity_id', entityId)
    .eq('supplier_id', supplierId)
    .eq('description_pattern', normalizedDesc)
    .maybeSingle();

  if (existing) {
    if (existing.gl_code === glCode) {
      const newTimesUsed = existing.times_used + 1;
      const newConfidence = getConfidenceForUses(newTimesUsed);
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

export async function getLearnedAllocations(
  entityId: string,
  supplierId: string,
  db: SupabaseClient
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
