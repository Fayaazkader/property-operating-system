// lib/intelligence/vacancy/vacancy-analytics.ts
// Vacancy Analytics — Intelligence layer

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
    // Get vacancies
    const { data: vacancies, error } = await supabase
      .from('vacancies')
      .select('id, status, vacancy_date')
      .eq('entity_id', entityId);

    if (error || !vacancies) {
      return getDefaultAnalytics();
    }

    // Get counts
    const vacancyIds = vacancies.map(v => v.id);

    const [enquiriesRes, viewingsRes, offersRes] = await Promise.all([
      supabase.from('enquiries').select('count', { count: 'exact', head: true }).in('vacancy_id', vacancyIds),
      supabase.from('viewings').select('count', { count: 'exact', head: true }).in('vacancy_id', vacancyIds),
      supabase.from('offers').select('count', { count: 'exact', head: true }).in('vacancy_id', vacancyIds),
    ]);

    const total = vacancies.length;
    const active = vacancies.filter(v => v.status === 'active').length;
    const marketing = vacancies.filter(v => v.status === 'marketing').length;
    const underOffer = vacancies.filter(v => v.status === 'under_offer').length;

    // Calculate average days vacant
    const now = new Date();
    let totalDays = 0;
    for (const v of vacancies) {
      const vacancyDate = new Date(v.vacancy_date);
      totalDays += Math.max(0, Math.floor((now.getTime() - vacancyDate.getTime()) / (1000 * 60 * 60 * 24)));
    }
    const avgDays = total > 0 ? Math.round(totalDays / total) : 0;

    const enquiries = enquiriesRes.count || 0;
    const viewings = viewingsRes.count || 0;
    const offers = offersRes.count || 0;

    return {
      total_vacancies: total,
      active_vacancies: active,
      marketing_vacancies: marketing,
      under_offer_vacancies: underOffer,
      average_days_vacant: avgDays,
      total_enquiries: enquiries,
      total_viewings: viewings,
      total_offers: offers,
      conversion_rate: enquiries > 0 ? (offers / enquiries) * 100 : 0,
    };
  } catch (error) {
    logger.error('Portfolio vacancy analytics error:', { error });
    return getDefaultAnalytics();
  }
}

function getDefaultAnalytics(): PortfolioVacancyAnalytics {
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
