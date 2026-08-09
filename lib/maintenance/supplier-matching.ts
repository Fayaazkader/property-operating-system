// lib/maintenance/supplier-matching.ts
// Supplier Matching Engine — Weighted scoring from DB profiles

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
  price_score: number;
}

export class SupplierMatchingEngine {

  async rankSuppliers(entityId: string, category: string, priority: string): Promise<SupplierRanking[]> {
    // Get matching profile weights from DB
    const { data: profile } = await supabase
      .from('supplier_matching_profiles')
      .select('*')
      .eq('entity_id', entityId)
      .eq('priority', priority)
      .single();

    const { data: scores } = await supabase
      .from('supplier_scores')
      .select('*, suppliers!inner(id, supplier_name)')
      .eq('entity_id', entityId)
      .order('overall_score', { ascending: false })
      .limit(10);

    if (!scores?.length) return [];

    const w = profile || { response_weight: 0.25, distance_weight: 0.25, availability_weight: 0.25, rating_weight: 0.25, price_weight: 0 };

    return (scores as any[]).map(s => {
      const weighted = 
        (s.avg_response_time_hours ? Math.max(0, 1 - (s.avg_response_time_hours / 48)) * (w.response_weight || 0) : 0) +
        (s.property_coverage || 0) * (w.distance_weight || 0) +
        (s.completion_rate || 0) * (w.availability_weight || 0) +
        (s.quality_rating || 0) * (w.rating_weight || 0) +
        (1 - (s.current_workload / 20)) * (w.price_weight || 0);

      return {
        supplier_id: s.supplier_id,
        supplier_name: (s as any).suppliers?.supplier_name || 'Unknown',
        overall_score: Math.round(weighted * 100) / 100,
        trade_match: s.trade_match || 0,
        response_score: s.avg_response_time_hours || 0,
        distance_score: s.property_coverage || 0,
        availability_score: s.completion_rate || 0,
        rating_score: s.quality_rating || 0,
        price_score: s.current_workload || 0,
      };
    }).sort((a, b) => b.overall_score - a.overall_score);
  }

  async getBestSupplier(entityId: string, category: string, priority: string): Promise<SupplierRanking | null> {
    const rankings = await this.rankSuppliers(entityId, category, priority);
    return rankings[0] || null;
  }
}

export const supplierMatchingEngine = new SupplierMatchingEngine();
