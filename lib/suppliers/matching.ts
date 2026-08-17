// lib/suppliers/matching.ts
// Supplier matching — find closest match for OCR-extracted supplier name

import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupplierMatch {
  supplier_id: string;
  supplier_name: string;
  confidence: number;
}

export async function findSupplierMatch(
  entityId: string,
  ocrSupplierName: string,
  db: SupabaseClient = supabase
): Promise<SupplierMatch | null> {
  if (!ocrSupplierName) return null;

  const { data: suppliers } = await db
    .from('suppliers')
    .select('id, supplier_name')
    .eq('entity_id', entityId);

  if (!suppliers?.length) return null;

  const target = ocrSupplierName.toLowerCase().trim();
  let bestMatch: SupplierMatch | null = null;
  let bestScore = 0;

  for (const supplier of suppliers) {
    const candidate = supplier.supplier_name.toLowerCase().trim();

    if (candidate === target) {
      return { supplier_id: supplier.id, supplier_name: supplier.supplier_name, confidence: 100 };
    }

    if (candidate.includes(target) || target.includes(candidate)) {
      const score = Math.round((Math.min(candidate.length, target.length) / Math.max(candidate.length, target.length)) * 100);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { supplier_id: supplier.id, supplier_name: supplier.supplier_name, confidence: score };
      }
    }

    const overlap = calculateOverlap(candidate, target);
    if (overlap > bestScore) {
      bestScore = overlap;
      bestMatch = { supplier_id: supplier.id, supplier_name: supplier.supplier_name, confidence: overlap };
    }
  }

  return bestMatch && bestMatch.confidence > 60 ? bestMatch : null;
}

function calculateOverlap(a: string, b: string): number {
  const aChars = new Set(a);
  const bChars = new Set(b);
  let matches = 0;
  for (const char of aChars) {
    if (bChars.has(char)) matches++;
  }
  const total = Math.max(aChars.size, bChars.size);
  return total > 0 ? Math.round((matches / total) * 100) : 0;
}
