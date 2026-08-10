// lib/intelligence/signal-registry.ts
// Signal Registry — PostgreSQL-backed, idempotent UPSERT

import { supabase } from '@/lib/supabase';
import type { IntelligenceSignal, DomainIntelligence, SignalDomain } from './types';

export async function publishSignal(signal: IntelligenceSignal): Promise<void> {
  // Deterministic fingerprint: domain + source_event + affected_entity_id + category
  await supabase.from('intelligence_signals').upsert({
    id: signal.id, domain: signal.domain, category: signal.category,
    severity: signal.severity, score: signal.score, title: signal.title,
    explanation: signal.explanation, recommendation: signal.recommendation,
    action: signal.action, affected_entity_id: signal.affected_entity_id,
    affected_entity_type: signal.affected_entity_type,
    source_event: signal.source_event, status: 'active',
    created_at: signal.created_at, expires_at: signal.expires_at,
  }, { onConflict: 'domain,source_event,affected_entity_id,category' });
}

export async function acknowledgeSignal(signalId: string): Promise<void> {
  await supabase.from('intelligence_signals').update({
    status: 'acknowledged', acknowledged_at: new Date().toISOString(),
  }).eq('id', signalId);
}

export async function resolveSignal(signalId: string): Promise<void> {
  await supabase.from('intelligence_signals').update({
    status: 'resolved', resolved_at: new Date().toISOString(),
  }).eq('id', signalId);
}

export async function suppressSignal(signalId: string, reason: string): Promise<void> {
  await supabase.from('intelligence_signals').update({
    status: 'suppressed', explanation: reason,
  }).eq('id', signalId);
}

export async function archiveSignal(signalId: string): Promise<void> {
  await supabase.from('intelligence_signals').update({
    status: 'archived',
  }).eq('id', signalId);
}

export async function getDomainSignals(domain: SignalDomain): Promise<IntelligenceSignal[]> {
  const { data } = await supabase
    .from('intelligence_signals')
    .select('*')
    .eq('domain', domain)
    .in('status', ['active', 'acknowledged'])
    .order('created_at', { ascending: false })
    .limit(50);
  return (data || []) as IntelligenceSignal[];
}

export async function getAllSignals(): Promise<IntelligenceSignal[]> {
  const { data } = await supabase
    .from('intelligence_signals')
    .select('*')
    .in('status', ['active', 'acknowledged'])
    .order('created_at', { ascending: false })
    .limit(100);
  return (data || []) as IntelligenceSignal[];
}

export async function getDomainIntelligence(domain: SignalDomain): Promise<DomainIntelligence> {
  const signals = await getDomainSignals(domain);
  return {
    domain,
    signals: signals.slice(0, 20),
    riskScore: 0, // Portfolio aggregates, domains just report signals
    summary: signals.length > 0 
      ? signals.slice(0, 3).map(s => s.title).join(' · ')
      : 'No signals',
  };
}
