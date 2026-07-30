'use client';

import { useState, useEffect, useRef } from 'react';
import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const steps = [
  {
    title: 'Lease',
    sub: 'Create & Activate',
    items: ['Tenant onboarding', 'Rental agreement', 'Escalation rules', 'Deposit handling'],
    color: 'emerald',
  },
  {
    title: 'Billing',
    sub: 'Rules & Charges',
    items: ['Recurring charges', 'Escalations', 'Utility recoveries', 'Parking & storage'],
    color: 'blue',
  },
  {
    title: 'Invoices',
    sub: 'Generate & Deliver',
    items: ['Auto-generated', 'VAT compliant', 'Tenant statements', 'WhatsApp delivery'],
    color: 'amber',
  },
  {
    title: 'Payments',
    sub: 'Receive & Allocate',
    items: ['Bank feed import', 'Auto-allocation', 'Receipt matching', 'Arrears tracking'],
    color: 'purple',
  },
  {
    title: 'Reconciliation',
    sub: 'Match & Verify',
    items: ['Bank statement match', 'Exception handling', 'Approval workflow', 'Audit trail'],
    color: 'rose',
  },
  {
    title: 'Reporting',
    sub: 'Analyze & Report',
    items: ['Income Statement', 'Balance Sheet', 'NOI reports', 'Budget vs Actual'],
    color: 'cyan',
  },
  {
    title: 'Intelligence',
    sub: 'Insight & Forecast',
    items: ['Morning Brief', 'Anomaly detection', 'Cash forecasting', 'Portfolio KPIs'],
    color: 'emerald',
  },
];

const colorMap: Record<string, { glow: string; border: string; dot: string; line: string }> = {
  emerald: { glow: 'shadow-emerald-500/20', border: 'border-emerald-500/30', dot: 'bg-emerald-400', line: 'bg-emerald-400/40' },
  blue: { glow: 'shadow-blue-500/20', border: 'border-blue-500/30', dot: 'bg-blue-400', line: 'bg-blue-400/40' },
  amber: { glow: 'shadow-amber-500/20', border: 'border-amber-500/30', dot: 'bg-amber-400', line: 'bg-amber-400/40' },
  purple: { glow: 'shadow-purple-500/20', border: 'border-purple-500/30', dot: 'bg-purple-400', line: 'bg-purple-400/40' },
  rose: { glow: 'shadow-rose-500/20', border: 'border-rose-500/30', dot: 'bg-rose-400', line: 'bg-rose-400/40' },
  cyan: { glow: 'shadow-cyan-500/20', border: 'border-cyan-500/30', dot: 'bg-cyan-400', line: 'bg-cyan-400/40' },
};

export function Journey() {
  const [activeStep, setActiveStep] = useState(-1);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Animate steps one by one
          let step = 0;
          const interval = setInterval(() => {
            setActiveStep(step);
            step++;
            if (step >= steps.length) clearInterval(interval);
          }, 400);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Section id="journey" className="relative overflow-hidden py-24">
      <Container>
        <div ref={sectionRef} className="text-center mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80 mb-6 font-medium">The Journey</p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            From lease creation
            <br />
            <span className="text-zinc-400">to portfolio intelligence.</span>
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            Every asset follows the same governed journey — from the moment a lease is signed to the insight that drives your next decision.
          </p>
        </div>

        {/* Horizontal workflow */}
        <div className="max-w-5xl mx-auto">
          {/* Step cards */}
          <div className="grid grid-cols-7 gap-3 mb-6">
            {steps.map((step, i) => {
              const c = colorMap[step.color];
              const isActive = i <= activeStep;
              return (
                <div
                  key={step.title}
                  className={`rounded-xl border p-3 text-center transition-all duration-500 ${
                    isActive ? `${c.border} ${c.glow} bg-white/[0.02] shadow-lg` : 'border-white/[0.05] bg-transparent'
                  }`}
                  style={{ opacity: isActive ? 1 : 0.4, transform: isActive ? 'translateY(0)' : 'translateY(8px)' }}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${c.dot} ${isActive ? 'animate-pulse' : ''}`} />
                    <span className={`text-[11px] font-semibold tracking-wide ${isActive ? 'text-white' : 'text-zinc-500'}`}>{step.title}</span>
                  </div>
                  <p className="text-[9px] text-zinc-600 font-light mb-2">{step.sub}</p>
                  <div className="space-y-0.5">
                    {step.items.map(item => (
                      <p key={item} className="text-[9px] text-zinc-600 font-light leading-tight">{item}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Connection line — fills as steps activate */}
          <div className="flex items-center px-8">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 flex items-center">
                {/* Dot */}
                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${i <= activeStep ? colorMap[step.color].dot : 'bg-zinc-800'}`} />
                {/* Line to next */}
                {i < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1 rounded-full overflow-hidden bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${colorMap[step.color].line}`}
                      style={{ width: i < activeStep ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bottom label */}
          <div className="text-center mt-8">
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 font-medium">
              {activeStep >= steps.length - 1 ? '✓ Complete lifecycle active' : `${activeStep + 1} of ${steps.length} steps`}
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
