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

const colorMap: Record<string, { dot: string; line: string; text: string; border: string; glow: string }> = {
  emerald: { dot: 'bg-emerald-400', line: 'bg-emerald-400/50', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/10' },
  blue: { dot: 'bg-blue-400', line: 'bg-blue-400/50', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/10' },
  amber: { dot: 'bg-amber-400', line: 'bg-amber-400/50', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/10' },
  purple: { dot: 'bg-purple-400', line: 'bg-purple-400/50', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-purple-500/10' },
  rose: { dot: 'bg-rose-400', line: 'bg-rose-400/50', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-rose-500/10' },
  cyan: { dot: 'bg-cyan-400', line: 'bg-cyan-400/50', text: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/10' },
};

export function Journey() {
  const [activeStep, setActiveStep] = useState(-1);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let step = 0;
          const interval = setInterval(() => {
            setActiveStep(step);
            step++;
            if (step >= steps.length) clearInterval(interval);
          }, 600);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const currentStep = activeStep >= 0 && activeStep < steps.length ? steps[activeStep] : null;
  const isComplete = activeStep >= steps.length - 1;

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
          
          {/* Top: Horizontal workflow line with nodes */}
          <div className="flex items-center justify-between px-4 mb-10">
            {steps.map((step, i) => {
              const c = colorMap[step.color];
              const isActive = i <= activeStep;
              const isCurrent = i === activeStep;
              return (
                <div key={step.title} className="flex items-center flex-1 last:flex-none">
                  {/* Node */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full transition-all duration-500 ${
                        isActive ? c.dot + (isCurrent ? ' animate-pulse shadow-lg' : '') : 'bg-zinc-800'
                      }`}
                      style={{ boxShadow: isActive ? `0 0 8px currentColor` : 'none' }}
                    />
                    <span className={`text-[10px] mt-2 font-medium transition-colors duration-500 whitespace-nowrap ${
                      isActive ? c.text : 'text-zinc-700'
                    }`}>
                      {isActive && i < activeStep ? '✓ ' : ''}{step.title}
                    </span>
                  </div>
                  {/* Connecting line */}
                  {i < steps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 rounded-full overflow-hidden bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${c.line}`}
                        style={{ width: i < activeStep ? '100%' : isCurrent ? '50%' : '0%' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom: Active step detail */}
          <div className="flex justify-center" style={{ minHeight: '120px' }}>
            {currentStep && (
              <div
                key={currentStep.title}
                className={`rounded-2xl border ${colorMap[currentStep.color].border} ${colorMap[currentStep.color].glow} bg-white/[0.02] backdrop-blur-sm px-8 py-6 text-center max-w-md w-full transition-all duration-500`}
              >
                <p className={`text-xs uppercase tracking-[0.2em] ${colorMap[currentStep.color].text} mb-2 font-medium`}>
                  {currentStep.title}
                </p>
                <p className="text-sm text-zinc-400 font-light mb-4">{currentStep.sub}</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {currentStep.items.map(item => (
                    <p key={item} className="text-[11px] text-zinc-500 font-light text-left">{item}</p>
                  ))}
                </div>
              </div>
            )}
            {isComplete && !currentStep && (
              <div className="rounded-2xl border border-emerald-500/30 shadow-emerald-500/10 bg-emerald-500/[0.02] backdrop-blur-sm px-8 py-6 text-center">
                <p className="text-emerald-400 text-lg mb-1">✓</p>
                <p className="text-sm text-white font-light">Complete lifecycle active</p>
                <p className="text-[11px] text-zinc-500 mt-1 font-light">All seven stages governed and auditable</p>
              </div>
            )}
          </div>

          {/* Progress indicator */}
          <div className="text-center mt-8">
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-700 font-medium">
              {activeStep < 0 ? 'Scroll to begin' : isComplete ? 'All stages complete' : `Stage ${activeStep + 1} of ${steps.length}`}
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
