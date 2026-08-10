import { supabase } from '@/lib/supabase';

export interface RiskSignal {
  domain: string;
  weight: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface PortfolioRisk {
  overall: 'low' | 'medium' | 'high';
  score: number;
  signals: RiskSignal[];
  summary: string;
}

export interface OvernightBrief {
  greeting: string;
  riskSummary: string;
  changes: string[];
  priorities: string[];
  focus: string[];
  timestamp: string;
}

export class PortfolioIntelligenceEngine {

  async getPortfolioRisk(entityId: string): Promise<PortfolioRisk> {
    const signals: RiskSignal[] = [];

    // Aggregate from Maintenance domain
    const { count: emergencies } = await supabase
      .from('maintenance_issues')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('priority', 'emergency')
      .in('status', ['reported', 'classified']);
    if (emergencies && emergencies > 0) {
      signals.push({ domain: 'maintenance', weight: emergencies * 30, description: `${emergencies} emergency maintenance issue${emergencies > 1 ? 's' : ''}`, severity: emergencies > 2 ? 'high' : 'medium' });
    }

    // Aggregate from Inspections domain
    const { data: criticalInsp } = await supabase
      .from('inspections')
      .select('id, title')
      .eq('entity_id', entityId)
      .in('severity', ['critical', 'high'])
      .gte('completed_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
    if (criticalInsp && criticalInsp.length > 0) {
      signals.push({ domain: 'inspections', weight: criticalInsp.length * 25, description: `${criticalInsp.length} high-risk inspection finding${criticalInsp.length > 1 ? 's' : ''}`, severity: criticalInsp.length > 3 ? 'high' : 'medium' });
    }

    // Aggregate from Revenue domain
    const { count: expiring } = await supabase
      .from('leases')
      .select('*', { count: 'exact', head: true })
      .eq('owner_entity_id', entityId)
      .eq('lease_status', 'Active')
      .lte('lease_end_date', new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]);
    if (expiring && expiring > 0) {
      signals.push({ domain: 'revenue', weight: expiring * 15, description: `${expiring} lease${expiring > 1 ? 's' : ''} expiring within 90 days`, severity: expiring > 5 ? 'medium' : 'low' });
    }

    // Aggregate from Compliance
    const { count: overdueInsp } = await supabase
      .from('inspections')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('status', 'scheduled')
      .lt('scheduled_date', new Date().toISOString().split('T')[0]);
    if (overdueInsp && overdueInsp > 0) {
      signals.push({ domain: 'compliance', weight: overdueInsp * 20, description: `${overdueInsp} overdue inspection${overdueInsp > 1 ? 's' : ''}`, severity: overdueInsp > 2 ? 'high' : 'medium' });
    }

    const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
    const score = Math.max(0, 100 - totalWeight);
    const overall = score >= 85 ? 'low' as const : score >= 60 ? 'medium' as const : 'high' as const;

    const summary = signals.length > 0 
      ? `Risk ${overall.toUpperCase()} — ${signals.map(s => s.description).join(' · ')}`
      : 'All systems operational';

    return { overall, score, signals, summary };
  }

  async getOvernightBrief(entityId: string): Promise<OvernightBrief> {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const changes: string[] = [];
    const priorities: string[] = [];
    const focus: string[] = [];

    // What changed?
    const { count: inspDone } = await supabase.from('inspections').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'completed').gte('completed_date', today);
    if (inspDone && inspDone > 0) changes.push(`${inspDone} inspection${inspDone > 1 ? 's' : ''} completed`);

    const { count: newMaint } = await supabase.from('maintenance_issues').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).gte('created_at', today);
    if (newMaint && newMaint > 0) changes.push(`${newMaint} maintenance issue${newMaint > 1 ? 's' : ''} reported`);

    const { count: payments } = await supabase.from('sub_ledger_entries').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('ledger_type', 'tenant').gt('credit_amount', 0).gte('posted_at', today);
    if (payments && payments > 0) changes.push(`Payments received from ${payments} tenant${payments > 1 ? 's' : ''}`);

    // What needs attention?
    const { data: ems } = await supabase.from('maintenance_issues').select('title').eq('entity_id', entityId).eq('priority', 'emergency').in('status', ['reported', 'classified']).limit(3);
    for (const e of (ems || [])) priorities.push(`Emergency: ${e.title}`);

    const { data: od } = await supabase.from('inspections').select('title').eq('entity_id', entityId).eq('status', 'scheduled').lt('scheduled_date', today).limit(2);
    for (const o of (od || [])) priorities.push(`Overdue: ${o.title}`);

    // Today's focus
    const { data: quotes } = await supabase.from('maintenance_quotes').select('id').eq('entity_id', entityId).eq('status', 'pending').limit(1);
    if (quotes && quotes.length > 0) focus.push('Approve pending maintenance quotes');

    const { data: sched } = await supabase.from('inspections').select('id').eq('entity_id', entityId).eq('status', 'scheduled').eq('scheduled_date', today).limit(1);
    if (sched && sched.length > 0) focus.push(`${sched.length} inspection${sched.length > 1 ? 's' : ''} scheduled today`);

    const risk = await this.getPortfolioRisk(entityId);

    return {
      greeting,
      riskSummary: risk.summary,
      changes,
      priorities,
      focus,
      timestamp: new Date().toISOString(),
    };
  }
}

export const portfolioIntelligenceEngine = new PortfolioIntelligenceEngine();
