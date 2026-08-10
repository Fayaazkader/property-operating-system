import { supabase } from '@/lib/supabase';

export interface PortfolioRisk {
  overall: 'low' | 'medium' | 'high';
  operational: number;
  revenue: number;
  compliance: number;
  maintenance: number;
  supplier: number;
  tenant: number;
  summary: string[];
}

export interface OvernightBrief {
  changes: string[];
  priorities: string[];
  riskSummary: string;
  timestamp: string;
}

export class PortfolioIntelligenceEngine {

  async getPortfolioRisk(entityId: string): Promise<PortfolioRisk> {
    const summary: string[] = [];

    // Operational risk — from maintenance
    const { count: emergencyIssues } = await supabase
      .from('maintenance_issues')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('priority', 'emergency')
      .in('status', ['reported', 'classified']);
    const operational = emergencyIssues && emergencyIssues > 3 ? 30 : emergencyIssues && emergencyIssues > 0 ? 70 : 95;

    // Revenue risk — from leases
    const { count: expiringLeases } = await supabase
      .from('leases')
      .select('*', { count: 'exact', head: true })
      .eq('owner_entity_id', entityId)
      .eq('lease_status', 'Active')
      .lte('lease_end_date', new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]);
    const revenue = expiringLeases && expiringLeases > 5 ? 30 : expiringLeases && expiringLeases > 0 ? 70 : 95;

    // Compliance risk — from inspections
    const { data: criticalInspections } = await supabase
      .from('inspections')
      .select('id')
      .eq('entity_id', entityId)
      .in('severity', ['critical', 'high'])
      .gte('completed_date', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]);
    const compliance = (criticalInspections || []).length > 5 ? 30 : (criticalInspections || []).length > 0 ? 65 : 95;

    // Maintenance risk
    const { count: overdueWO } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .in('status', ['pending', 'assigned'])
      .lt('scheduled_date', new Date().toISOString().split('T')[0]);
    const maintenance = overdueWO && overdueWO > 5 ? 30 : overdueWO && overdueWO > 0 ? 65 : 95;

    // Supplier risk
    const supplier = 90;
    const tenant = 85;

    const avgRisk = Math.round((operational + revenue + compliance + maintenance + supplier + tenant) / 6);
    const overall = avgRisk >= 85 ? 'low' as const : avgRisk >= 60 ? 'medium' as const : 'high' as const;

    if (emergencyIssues && emergencyIssues > 0) summary.push(`${emergencyIssues} active emergencies`);
    if (expiringLeases && expiringLeases > 0) summary.push(`${expiringLeases} leases expiring within 90 days`);
    if (criticalInspections && criticalInspections.length > 0) summary.push(`${criticalInspections.length} high-risk inspection findings`);
    if (overdueWO && overdueWO > 0) summary.push(`${overdueWO} overdue work orders`);

    return { overall, operational, revenue, compliance, maintenance, supplier, tenant, summary };
  }

  async getOvernightBrief(entityId: string): Promise<OvernightBrief> {
    const today = new Date().toISOString().split('T')[0];
    const changes: string[] = [];
    const priorities: string[] = [];

    // Inspections completed today
    const { count: inspectionsDone } = await supabase
      .from('inspections')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('status', 'completed')
      .gte('completed_date', today);
    if (inspectionsDone && inspectionsDone > 0) changes.push(`${inspectionsDone} inspection${inspectionsDone > 1 ? 's' : ''} completed`);

    // New maintenance issues
    const { count: newIssues } = await supabase
      .from('maintenance_issues')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .gte('created_at', today);
    if (newIssues && newIssues > 0) changes.push(`${newIssues} new maintenance issue${newIssues > 1 ? 's' : ''}`);

    // Payments received
    const { count: payments } = await supabase
      .from('sub_ledger_entries')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('ledger_type', 'tenant')
      .gt('credit_amount', 0)
      .gte('posted_at', today);
    if (payments && payments > 0) changes.push(`Payments received from ${payments} tenant${payments > 1 ? 's' : ''}`);

    // High priority items
    const { data: emergencies } = await supabase
      .from('maintenance_issues')
      .select('title')
      .eq('entity_id', entityId)
      .eq('priority', 'emergency')
      .in('status', ['reported', 'classified'])
      .limit(3);
    for (const e of (emergencies || [])) {
      priorities.push(`Emergency: ${e.title}`);
    }

    const { data: overdue } = await supabase
      .from('inspections')
      .select('title')
      .eq('entity_id', entityId)
      .eq('status', 'scheduled')
      .lt('scheduled_date', today)
      .limit(2);
    for (const o of (overdue || [])) {
      priorities.push(`Overdue inspection: ${o.title}`);
    }

    const risk = await this.getPortfolioRisk(entityId);

    return {
      changes,
      priorities,
      riskSummary: `Portfolio risk: ${risk.overall.toUpperCase()} · ${risk.summary.join(' · ')}`,
      timestamp: new Date().toISOString(),
    };
  }

  async getUnifiedTimeline(entityId: string, limit = 20): Promise<any[]> {
    const { data } = await supabase
      .from('activity_feed')
      .select('*')
      .eq('entity_id', entityId)
      .order('occurred_at', { ascending: false })
      .limit(limit);
    return data || [];
  }
}

export const portfolioIntelligenceEngine = new PortfolioIntelligenceEngine();
