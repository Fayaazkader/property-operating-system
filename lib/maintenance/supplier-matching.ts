// lib/maintenance/supplier-matching.ts
// Supplier Matching Engine — Hard filters with expiry checks → Weighted scoring → Ranking

import { supabase } from '@/lib/supabase';

export interface SupplierRanking {
  supplier_id: string;
  supplier_name: string;
  overall_score: number;
  trade_match: number;
  response_score: number;
  distance_score: number;
  availability_score: number;
  rating_score: number;
  workload_score: number;
  filtered_out?: boolean;
  filter_reason?: string;
}

export class SupplierMatchingEngine {

  async rankSuppliers(entityId: string, category: string, priority: string): Promise<SupplierRanking[]> {
    const { data: profile } = await supabase
      .from('supplier_matching_profiles')
      .select('*')
      .eq('entity_id', entityId)
      .eq('priority', priority)
      .single();

    const { data: scores } = await supabase
      .from('supplier_scores')
      .select('*, suppliers!inner(id, supplier_name, insurance_valid, insurance_expiry, trade_certified, trade_certificate_expiry, preferred_supplier, after_hours, max_travel_radius_km)')
      .eq('entity_id', entityId)
      .order('overall_score', { ascending: false })
      .limit(50);

    if (!scores?.length) return [];

    const p = profile || {};
    const now = new Date();
    const rankings: SupplierRanking[] = [];

    for (const s of (scores as any[])) {
      const supplier = s.suppliers || {};

      // HARD FILTER: Insurance (with expiry check)
      if (p.require_insurance) {
        const insured = supplier.insurance_valid && 
          (!supplier.insurance_expiry || new Date(supplier.insurance_expiry) >= now);
        if (!insured) {
          rankings.push(emptyRanking(s, 'Insurance required or expired'));
          continue;
        }
      }

      // HARD FILTER: Trade certification (with expiry check)
      if (p.require_trade_certification) {
        const certified = supplier.trade_certified && 
          (!supplier.trade_certificate_expiry || new Date(supplier.trade_certificate_expiry) >= now);
        if (!certified) {
          rankings.push(emptyRanking(s, 'Trade certification required or expired'));
          continue;
        }
      }

      // HARD FILTER: Max capacity
      if (p.max_active_jobs && s.current_workload >= p.max_active_jobs) {
        rankings.push(emptyRanking(s, 'At max capacity'));
        continue;
      }

      // HARD FILTER: Preferred suppliers only
      if (p.preferred_supplier_only && !supplier.preferred_supplier) {
        rankings.push(emptyRanking(s, 'Preferred suppliers only'));
        continue;
      }

      // WEIGHTED SCORING
      const responseScore = s.avg_response_time_hours ? Math.max(0, 1 - (s.avg_response_time_hours / 48)) : 0.5;
      const distanceScore = s.property_coverage || 0.5;
      const availabilityScore = s.completion_rate || 0.5;
      const ratingScore = s.quality_rating || 0.5;
      const workloadScore = s.current_workload ? Math.max(0, 1 - (s.current_workload / 20)) : 1;

      const weighted =
        responseScore * (p.response_weight || 0.25) +
        distanceScore * (p.distance_weight || 0.25) +
        availabilityScore * (p.availability_weight || 0.25) +
        ratingScore * (p.rating_weight || 0.25) +
        workloadScore * (p.price_weight || 0);

      rankings.push({
        supplier_id: s.supplier_id,
        supplier_name: supplier.supplier_name || 'Unknown',
        overall_score: Math.round(weighted * 100) / 100,
        trade_match: s.trade_match || 0,
        response_score: Math.round(responseScore * 100) / 100,
        distance_score: Math.round(distanceScore * 100) / 100,
        availability_score: Math.round(availabilityScore * 100) / 100,
        rating_score: Math.round(ratingScore * 100) / 100,
        workload_score: Math.round(workloadScore * 100) / 100,
      });
    }

    return rankings.sort((a, b) => b.overall_score - a.overall_score);
  }

  async getBestSupplier(entityId: string, category: string, priority: string): Promise<SupplierRanking | null> {
    const rankings = await this.rankSuppliers(entityId, category, priority);
    return rankings.find(r => !r.filtered_out) || null;
  }
}

function emptyRanking(s: any, reason: string): SupplierRanking {
  return {
    supplier_id: s.supplier_id,
    supplier_name: s.suppliers?.supplier_name || 'Unknown',
    overall_score: 0, trade_match: 0, response_score: 0,
    distance_score: 0, availability_score: 0, rating_score: 0, workload_score: 0,
    filtered_out: true, filter_reason: reason,
  };
}

export const supplierMatchingEngine = new SupplierMatchingEngine();

  // Check conflicts inside matching engine
  async getEligibleSuppliers(entityId: string, category: string, priority: string): Promise<SupplierRanking[]> {
    const { data: conflicts } = await supabase
      .from('supplier_conflicts')
      .select('supplier_id')
      .eq('entity_id', entityId)
      .eq('is_active', true);

    const blockedIds = (conflicts || []).map(c => c.supplier_id);
    const rankings = await this.rankSuppliers(entityId, category, priority);
    return rankings.filter(r => !blockedIds.includes(r.supplier_id) && !r.filtered_out);
  }
