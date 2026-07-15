// lib/portfolio/engine.ts
// Portfolio Intelligence Engine — Read-model optimized, snapshot-based

import { supabase } from '@/lib/supabase';
import { subscribe, publish } from '../platform/events/event-bus';
import { logger } from '../platform/events/logger.service';
import { readModelStore } from './read-model-store';
import type { PortfolioMetrics, PortfolioTrend, MorningBriefEnrichment, AttentionItem, TodayItem, QuickAction } from './types';

export class PortfolioEngine {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Subscribe to events that affect portfolio metrics
    const events = [
      'lease.activated', 'lease.expiring',
      'property.work_order.created', 'property.work_order.completed',
      'payment.request.approved', 'payment.batch.confirmed',
      'supplier.invoice.created',
      'broker.commission.approved', 'broker.offer.accepted',
      'property.inspection.completed', 'property.compliance.expired',
    ];

    for (const event of events) {
      subscribe(event, async (e) => {
        const entityId = e.entity?.tenantId || e.payload?.entity_id || e.payload?.entityId;
        if (entityId) {
          await this.invalidateReadModels(entityId);
        }
      });
    }

    this.initialized = true;
    logger.info('Portfolio Engine initialized — listening to operational events');
  }

  private async invalidateReadModels(entityId: string): Promise<void> {
    await readModelStore.invalidate(entityId);
    logger.debug('Portfolio read models invalidated', { entityId });
  }

  // ============================================================
  // METRICS — From read model or compute
  // ============================================================

  async getMetrics(entityId: string): Promise<PortfolioMetrics> {
    // Try read model first
    const cached = await readModelStore.get(entityId, 'full');
    if (cached) {
      return cached.model_data as PortfolioMetrics;
    }

    // Compute fresh
    const today = new Date().toISOString().split('T')[0];
    const metrics = await this.computeMetrics(entityId, today);

    // Cache for 15 minutes
    await readModelStore.set(entityId, 'full', metrics as any);

    // Store daily snapshot
    await this.storeSnapshot(entityId, today, metrics);

    return metrics;
  }

  private async computeMetrics(entityId: string, date: string): Promise<PortfolioMetrics> {
    const [
      occupancy, revenue, operations, financial, brokerage, automation,
    ] = await Promise.all([
      this.computeOccupancy(entityId),
      this.computeRevenue(entityId),
      this.computeOperations(entityId, date),
      this.computeFinancial(entityId, date),
      this.computeBrokerage(entityId),
      this.computeAutomation(entityId, date),
    ]);

    return {
      entity_id: entityId,
      snapshot_date: date,
      ...occupancy, ...revenue, ...operations, ...financial, ...brokerage, ...automation,
    };
  }

  private async computeOccupancy(entityId: string) {
    const { data: properties } = await supabase.from('properties').select('gla_sqm').eq('entity_id', entityId);
    const totalGLA = (properties || []).reduce((s, p) => s + (p.gla_sqm || 0), 0);
    const { count: total } = await supabase.from('units').select('*', { count: 'exact', head: true }).eq('entity_id', entityId);
    const { count: vacant } = await supabase.from('units').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'vacant');
    const occupied = (total || 0) - (vacant || 0);
    return {
      total_gla_sqm: totalGLA,
      occupied_gla_sqm: total ? Math.round(totalGLA * (occupied / total)) : 0,
      occupancy_rate: total ? Math.round((occupied / total) * 100) : 0,
      vacant_units: vacant || 0,
      total_units: total || 0,
    };
  }

  private async computeRevenue(entityId: string) {
    const { data: leases } = await supabase.from('leases').select('monthly_rental').eq('entity_id', entityId).eq('status', 'active');
    const monthly = (leases || []).reduce((s, l) => s + (l.monthly_rental || 0), 0);
    const { data: arrears } = await supabase.from('arrears').select('amount').eq('entity_id', entityId);
    const arrearsTotal = (arrears || []).reduce((s, a) => s + (a.amount || 0), 0);
    const noi = monthly * 0.65;
    return {
      gross_monthly_rental: monthly, gross_annual_rental: monthly * 12,
      arrears_total: arrearsTotal,
      arrears_rate: monthly > 0 ? Math.round((arrearsTotal / monthly) * 100) : 0,
      noi: Math.round(noi),
      noi_margin: monthly > 0 ? Math.round((noi / monthly) * 100) : 0,
    };
  }

  private async computeOperations(entityId: string, today: string) {
    const [{ count: open }, { count: overdue }, { count: inspections }, { count: expiring }, { count: expired }] = await Promise.all([
      supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).in('status', ['open', 'in_progress']),
      supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).in('status', ['open', 'in_progress']).lt('due_date', today),
      supabase.from('inspections').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'scheduled'),
      supabase.from('compliance_items').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'active').lte('expiry_date', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
      supabase.from('compliance_items').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'expired'),
    ]);
    return { open_work_orders: open || 0, overdue_work_orders: overdue || 0, inspections_due: inspections || 0, compliance_expiring: expiring || 0, compliance_expired: expired || 0 };
  }

  private async computeFinancial(entityId: string, today: string) {
    const [{ count: awaiting }, { data: due }, { count: batches }] = await Promise.all([
      supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'pending_approval'),
      supabase.from('payment_requests').select('amount').eq('entity_id', entityId).eq('due_date', today).in('status', ['approved', 'queued', 'batched']),
      supabase.from('payment_batches').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'ready'),
    ]);
    const dueTotal = (due || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
    return { payments_awaiting_approval: awaiting || 0, payments_due_today: dueTotal, batches_ready: batches || 0 };
  }

  private async computeBrokerage(entityId: string) {
    const [{ count: vacancies }, { count: mandates }, { count: pending }, { data: comms }] = await Promise.all([
      supabase.from('vacancies').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'active'),
      supabase.from('mandates').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'active'),
      supabase.from('commissions').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'pending_approval'),
      supabase.from('commissions').select('total_commission').eq('entity_id', entityId).eq('status', 'pending_approval'),
    ]);
    const pendingValue = (comms || []).reduce((s: number, c: any) => s + (c.total_commission || 0), 0);
    return { active_vacancies: vacancies || 0, active_mandates: mandates || 0, commissions_pending: pending || 0, commissions_pending_value: pendingValue };
  }

  private async computeAutomation(entityId: string, today: string) {
    const [{ count: rules }, { count: triggered }] = await Promise.all([
      supabase.from('automation_rules').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'active'),
      supabase.from('automation_execution_log').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).gte('started_at', today),
    ]);
    return { active_automations: rules || 0, automations_triggered_today: triggered || 0 };
  }

  // ============================================================
  // TRENDS
  // ============================================================

  async getTrends(entityId: string, days: number = 30): Promise<PortfolioTrend[]> {
    const current = await this.getMetrics(entityId);
    const pastDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const { data: prev } = await supabase.from('portfolio_snapshots').select('metrics').eq('entity_id', entityId).eq('snapshot_date', pastDate).single();
    if (!prev) return [];

    const previous = prev.metrics as PortfolioMetrics;
    const keys = [
      { key: 'occupancy_rate', label: 'Occupancy Rate' },
      { key: 'gross_monthly_rental', label: 'Monthly Revenue' },
      { key: 'arrears_total', label: 'Arrears' },
      { key: 'open_work_orders', label: 'Open Work Orders' },
      { key: 'active_vacancies', label: 'Active Vacancies' },
    ];

    return keys.map(({ key, label }) => {
      const curr = (current as any)[key] || 0;
      const prev_val = (previous as any)[key] || 0;
      const change = prev_val > 0 ? ((curr - prev_val) / prev_val) * 100 : 0;
      return { metric: label, current: curr, previous: prev_val, change_pct: Math.round(change * 10) / 10, trend: change > 1 ? 'up' : change < -1 ? 'down' : 'stable' };
    });
  }

  // ============================================================
  // MORNING BRIEF — From read model
  // ============================================================

  async getMorningBrief(entityId: string): Promise<MorningBriefEnrichment> {
    // Try cached brief first (short TTL — 5 min)
    const cached = await readModelStore.get(entityId, 'morning_brief');
    if (cached) return cached.model_data as MorningBriefEnrichment;

    const metrics = await this.getMetrics(entityId);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const attentionItems: AttentionItem[] = [];
    if (metrics.compliance_expired > 0) attentionItems.push({ id: 'ce', type: 'compliance', title: `${metrics.compliance_expired} compliance expired`, description: 'Immediate action required', severity: 'high', link: '/property-operations/compliance' });
    if (metrics.overdue_work_orders > 0) attentionItems.push({ id: 'ow', type: 'work_order', title: `${metrics.overdue_work_orders} overdue work orders`, description: 'Requires attention', severity: 'high', link: '/property-operations/work-orders' });
    if (metrics.payments_awaiting_approval > 0) attentionItems.push({ id: 'pa', type: 'payment', title: `${metrics.payments_awaiting_approval} payments awaiting approval`, description: `R${metrics.payments_due_today.toLocaleString()} due today`, severity: 'medium', link: '/disbursement/payments' });
    if (metrics.commissions_pending > 0) attentionItems.push({ id: 'cp', type: 'commission', title: `${metrics.commissions_pending} commissions pending`, description: `R${metrics.commissions_pending_value.toLocaleString()}`, severity: 'medium', link: '/brokerage/commissions' });

    const todayItems: TodayItem[] = [];
    if (metrics.payments_due_today > 0) todayItems.push({ id: 'pd', type: 'payment', title: `R${metrics.payments_due_today.toLocaleString()} in payments due`, time: 'Today', link: '/disbursement/payments' });
    if (metrics.inspections_due > 0) todayItems.push({ id: 'id', type: 'inspection', title: `${metrics.inspections_due} inspections scheduled`, time: 'Today', link: '/property-operations/inspections' });

    const quickActions: QuickAction[] = [
      { id: 'wo', label: 'Create Work Order', link: '/property-operations/work-orders/new', icon: 'Wrench' },
      { id: 'ap', label: 'Approve Payments', link: '/disbursement/payments', icon: 'DollarSign' },
      { id: 'vp', label: 'View Portfolio', link: '/portfolio', icon: 'BarChart3' },
    ];

    const brief: MorningBriefEnrichment = {
      greeting,
      date: new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      summary: `${metrics.occupancy_rate}% occupied · R${(metrics.gross_monthly_rental / 1000).toFixed(0)}k/mo · ${metrics.open_work_orders} open WOs`,
      attention_items: attentionItems,
      today_items: todayItems,
      metrics_snapshot: { occupancy: `${metrics.occupancy_rate}%`, revenue: `R${(metrics.gross_monthly_rental / 1000).toFixed(0)}k`, arrears: `${metrics.arrears_rate}%`, work_orders: `${metrics.open_work_orders} open` },
      quick_actions: quickActions,
    };

    // Cache brief for 5 minutes
    await readModelStore.set(entityId, 'morning_brief', brief as any, 5);

    await publish('morning_brief.enriched', {
      correlationId: crypto.randomUUID(),
      source: 'portfolio-engine',
      version: '1.0',
      payload: brief,
    });

    return brief;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async storeSnapshot(entityId: string, date: string, metrics: PortfolioMetrics): Promise<void> {
    try {
      await supabase.from('portfolio_snapshots').upsert({ entity_id: entityId, snapshot_date: date, metrics }, { onConflict: 'entity_id,snapshot_date' });
    } catch (error) {
      logger.error('Failed to store snapshot', { error });
    }
  }
}

export const portfolioEngine = new PortfolioEngine();
