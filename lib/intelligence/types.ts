// lib/intelligence/types.ts
// Platform-standard intelligence signals — every domain publishes these

export type SignalDomain = 'maintenance' | 'inspections' | 'revenue' | 'supplier' | 'communications' | 'compliance' | 'tenant' | 'utilities' | 'procurement';
export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SignalCategory = 'risk' | 'opportunity' | 'anomaly' | 'status';

export interface IntelligenceSignal {
  id: string;
  domain: SignalDomain;
  category: SignalCategory;
  severity: SignalSeverity;
  score: number;
  title: string;
  explanation: string;
  recommendation?: string;
  action?: string;
  affected_entity_id?: string;
  affected_entity_type?: string;
  source_event: string;
  created_at: string;
  expires_at?: string;
}

export interface Recommendation {
  id: string;
  priority: number;
  title: string;
  reasoning: string[];
  confidence: number;
  action: string;
  domain: SignalDomain;
  signals: string[];
}

export interface DomainIntelligence {
  domain: SignalDomain;
  signals: IntelligenceSignal[];
  riskScore: number;
  summary: string;
}
