// lib/brokerage/queries/vacancy.queries.ts
// Read-only queries — All metrics derived, not stored

import { supabase } from "@/lib/supabase";
import { VacancyMetrics } from "../engine/vacancy.types";

// ============================================================
// GET VACANCY WITH DERIVED METRICS
// ============================================================

export async function getVacancyWithMetrics(vacancyId: string): Promise<{
  vacancy: any;
  metrics: VacancyMetrics;
} | null> {
  try {
    // Get vacancy
    const { data: vacancy, error: vError } = await supabase
      .from('vacancies')
      .select(`
        *,
        property:properties(property_name),
        unit:units(unit_number),
        current_broker:brokers(name, company:broker_companies(name))
      `)
      .eq('id', vacancyId)
      .single();

    if (vError || !vacancy) {
      return null;
    }

    // Get derived counts
    const [enquiriesRes, viewingsRes, offersRes] = await Promise.all([
      supabase.from('enquiries').select('count', { count: 'exact', head: true }).eq('vacancy_id', vacancyId),
      supabase.from('viewings').select('count', { count: 'exact', head: true }).eq('vacancy_id', vacancyId),
      supabase.from('offers').select('count', { count: 'exact', head: true }).eq('vacancy_id', vacancyId),
    ]);

    const enquiryCount = enquiriesRes.count || 0;
    const viewingCount = viewingsRes.count || 0;
    const offerCount = offersRes.count || 0;

    // Calculate days vacant
    const vacancyDate = new Date(vacancy.vacancy_date);
    const now = new Date();
    const daysVacant = Math.max(0, Math.floor((now.getTime() - vacancyDate.getTime()) / (1000 * 60 * 60 * 24)));

    const metrics: VacancyMetrics = {
      days_vacant: daysVacant,
      enquiry_count: enquiryCount,
      viewing_count: viewingCount,
      offer_count: offerCount,
      conversion_rate: enquiryCount > 0 ? (offerCount / enquiryCount) * 100 : 0,
    };

    return { vacancy, metrics };
  } catch (error) {
    console.error('Error fetching vacancy metrics:', error);
    return null;
  }
}
