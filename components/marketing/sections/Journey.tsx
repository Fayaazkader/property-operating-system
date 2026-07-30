'use client';

import { useState, useEffect, useRef } from 'react';
import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const steps = [
  { title: 'Lease', sub: 'Create & Activate', items: ['Tenant onboarding', 'Rental agreement', 'Escalation rules', 'Deposit handling'], color: 'emerald' },
  { title: 'Billing', sub: 'Rules & Charges', items: ['Recurring charges', 'Escalations', 'Utility recoveries', 'Parking & storage'], color: 'blue' },
  { title: 'Invoices', sub: 'Generate & Deliver', items: ['Auto-generated', 'VAT compliant', 'Tenant statements', 'WhatsApp delivery'], color: 'amber' },
  { title: 'Payments', sub: 'Receive & Allocate', items: ['Bank feed import', 'Auto-allocation', 'Receipt matching', 'Arrears tracking'], color: 'purple' },
  { title: 'Reconciliation', sub: 'Match & Verify', items: ['Bank statement match', 'Exception handling', 'Approval workflow', 'Audit trail'], color: 'rose' },
  { title: 'Reporting', sub: 'Analyze & Report', items: ['Income Statement', 'Balance Sheet', 'NOI reports', 'Budget vs Actual'], color: 'cyan' },
  { title: 'Intelligence', sub: 'Insight & Forecast', items: ['Morning Brief', 'Anomaly detection', 'Cash forecasting', 'Portfolio KPIs'], color: 'emerald' },
];

const colorMap: Record<string, { dot: string; line: string; text: string; border: string }> = {
  emerald: { dot: 'bg-emerald-400', line: 'bg-emerald-400/50', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  blue: { dot: 'bg-blue-400', line: 'bg-blue-400/50', text: 'text-blue-400', border: 'border-blue-500/30' },
  amber: { dot: 'bg-amber-400', line: 'bg-amber-400/50', text: 'text-amber-400', border: 'border-amber-500/30' },
  purple: { dot: 'bg-purple-400', line: 'bg-purple-400/50', text: 'text-purple-400', border: 'border-purple-500/30' },
  rose: { dot: 'bg-rose-400', line: 'bg-rose-400/50', text: 'text-rose-400', border: 'border-rose-500/30' },
  cyan: { dot: 'bg-cyan-400', line: 'bg-cyan-400/50', text: 'text-cyan-400', border: 'border-cyan-500/30' },
};

type JourneyPhase = { type: 'idle' } | { type: 'step'; index: number } | { type: 'complete' };

export function Journey() {
  const [phase, setPhase] = useState<JourneyPhase>({ type: 'idle' });
  const [transitioning, setTransitioning] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let step = 0;
          const interval = setInterval(() => {
            setTransitioning(true);
            setPhase({ type: 'step', index: step });
            setTimeout(() => setTransitioning(false), 400);
            step++;
            if (step >= steps.length) {
              clearInterval(interval);
              setTimeout(() => {
                setTransitioning(true);
                setPhase({ type: 'complete' });
                setTimeout(() => setTransitioning(false), 400);
              }, 600);
            }
          }, 600);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const activeIndex = phase.type === 'step' ? phase.index : steps.length - 1;

  return (
    <Section id="journey" className="relative overflow-hidden py-24">
      <Container>
        <div ref={sectionRef} className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80 mb-6 font-medium">The Journey</p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            From lease creation
            <br />
            <span className="text-zinc-400">to portfolio intelligence.</span>
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            Every asset follows the same governed journey — from the moment a lease is signed to the intelligence that drives every decision.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Workflow line */}
          <div className="flex items-center justify-between px-4 mb-10">
            {steps.map((step, i) => {
              const c = colorMap[step.color];
              const isActive = i <= activeIndex;
              const isCurrent = phase.type === 'step' && i === phase.index;
              const isLast = i === steps.length - 1;
              return (
                <div key={step.title} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full transition-all duration-500 ${isActive ? c.dot : 'bg-zinc-800'}`}
                      style={{ transform: isLast && phase.type === 'complete' ? 'scale(1.5)' : 'scale(1)' }}
                    >
                      {isCurrent && <div className={`absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full ${c.dot} opacity-60 animate-ping`} />}
                    </div>
                    <span className={`text-[10px] mt-2 font-medium transition-colors duration-500 whitespace-nowrap ${isActive ? c.text : 'text-zinc-700'}`}>
                      {isActive && i < activeIndex ? '✓ ' : ''}{step.title}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 rounded-full overflow-hidden bg-zinc-800 relative">
                      <div className={`h-full rounded-full transition-all duration-700 ${c.line}`} style={{ width: i < activeIndex ? '100%' : '0%' }} />
                      {isCurrent && <div className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${c.dot}`} style={{ left: '0%', animation: 'travelRight 0.6s ease-in-out forwards' }} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail area */}
          <div className="flex justify-center" style={{ minHeight: '130px' }}>
            {phase.type === 'step' && (
              <div className={`rounded-2xl border ${colorMap[steps[phase.index].color].border} bg-white/[0.02] backdrop-blur-sm px-8 py-6 text-center max-w-md w-full transition-all duration-400 ${transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                <p className={`text-xs uppercase tracking-[0.2em] ${colorMap[steps[phase.index].color].text} mb-2 font-medium`}>{steps[phase.index].title}</p>
                <p className="text-sm text-zinc-400 font-light mb-4">{steps[phase.index].sub}</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {steps[phase.index].items.map(item => <p key={item} className="text-[11px] text-zinc-500 font-light text-left">{item}</p>)}
                </div>
              </div>
            )}
            {phase.type === 'complete' && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.02] backdrop-blur-sm px-10 py-8 text-center transition-all duration-500">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-400 text-lg">✓</span>
                </div>
                <p className="text-base text-white font-light">Complete Operational Lifecycle</p>
                <p className="text-[11px] text-zinc-500 mt-2 font-light max-w-xs mx-auto leading-relaxed">
                  Every stage is connected, governed and auditable — from lease creation to portfolio intelligence.
                </p>
              </div>
            )}
          </div>

          <div className="text-center mt-8">
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-700 font-medium">
              {phase.type === 'idle' ? 'Scroll to begin' : phase.type === 'complete' ? 'All stages complete' : `Stage ${phase.index + 1} of ${steps.length}`}
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
