// lib/brokerage/vacancies/vacancy-analytics.ts
// Vacancy Analytics Queries

import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/platform/events/logger.service";

export interface PortfolioVacancyAnalytics {
  total_vacancies: number;
  active_vacancies: number;
  marketing_vacancies: number;
  under_offer_vacancies: number;
  average_days_vacant: number;
  total_enquiries: number;
  total_viewings: number;
  total_offers: number;
  conversion_rate: number;
}

export async function getPortfolioVacancyAnalytics(entityId: string): Promise<PortfolioVacancyAnalytics> {
  try {
    const { data, error } = await supabase
      .from('vacancies')
      .select('status, days_vacant, enquiry_count, viewing_count, offer_count')
      .eq('entity_id', entityId);

    if (error || !data) {
      return {
        total_vacancies: 0,
        active_vacancies: 0,
        marketing_vacancies: 0,
        under_offer_vacancies: 0,
        average_days_vacant: 0,
        total_enquiries: 0,
        total_viewings: 0,
        total_offers: 0,
        conversion_rate: 0,
      };
    }

    const total = data.length;
    const active = data.filter(v => v.status === 'active').length;
    const marketing = data.filter(v => v.status === 'marketing').length;
    const underOffer = data.filter(v => v.status === 'under_offer').length;
    const avgDays = data.reduce((sum, v) => sum + (v.days_vacant || 0), 0) / (total || 1);
    const enquiries = data.reduce((sum, v) => sum + (v.enquiry_count || 0), 0);
    const viewings = data.reduce((sum, v) => sum + (v.viewing_count || 0), 0);
    const offers = data.reduce((sum, v) => sum + (v.offer_count || 0), 0);

    return {
      total_vacancies: total,
      active_vacancies: active,
      marketing_vacancies: marketing,
      under_offer_vacancies: underOffer,
      average_days_vacant: Math.round(avgDays),
      total_enquiries: enquiries,
      total_viewings: viewings,
      total_offers: offers,
      conversion_rate: enquiries > 0 ? (offers / enquiries) * 100 : 0,
    };
  } catch (error) {
    logger.error('Portfolio vacancy analytics error:', { error });
    return {
      total_vacancies: 0,
      active_vacancies: 0,
      marketing_vacancies: 0,
      under_offer_vacancies: 0,
      average_days_vacant: 0,
      total_enquiries: 0,
      total_viewings: 0,
      total_offers: 0,
      conversion_rate: 0,
    };
  }
}
