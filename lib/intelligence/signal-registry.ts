// lib/intelligence/signal-registry.ts
// Signal Registry — Every domain publishes signals here. Portfolio Intelligence reads from here.

import type { IntelligenceSignal, DomainIntelligence, SignalDomain } from './types';

const domainSignals: Map<SignalDomain, IntelligenceSignal[]> = new Map();

export function publishSignal(signal: IntelligenceSignal): void {
  if (!domainSignals.has(signal.domain)) {
    domainSignals.set(signal.domain, []);
  }
  domainSignals.get(signal.domain)!.push(signal);
  
  // Keep only last 100 signals per domain
  const signals = domainSignals.get(signal.domain)!;
  if (signals.length > 100) signals.shift();
}

export function getDomainSignals(domain: SignalDomain): IntelligenceSignal[] {
  return domainSignals.get(domain) || [];
}

export function getAllSignals(): IntelligenceSignal[] {
  const all: IntelligenceSignal[] = [];
  for (const signals of domainSignals.values()) {
    all.push(...signals);
  }
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getDomainIntelligence(domain: SignalDomain): DomainIntelligence {
  const signals = getDomainSignals(domain);
  const totalWeight = signals.reduce((s, sig) => s + sig.score, 0);
  const riskScore = Math.max(0, 100 - totalWeight);
  return {
    domain,
    signals: signals.slice(-20),
    riskScore,
    summary: signals.length > 0 
      ? signals.slice(0, 3).map(s => s.title).join(' · ')
      : 'No signals',
  };
}

export function clearDomain(domain: SignalDomain): void {
  domainSignals.delete(domain);
}
