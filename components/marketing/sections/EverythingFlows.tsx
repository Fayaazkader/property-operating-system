'use client';

import { useEffect, useRef, useState } from 'react';
import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const FLOW_STEPS = [
  { step: '01', label: 'Lease Activated', detail: 'Tenant signs. Billing scheduled automatically. Deposit registered. Portfolio occupancy updated.' },
  { step: '02', label: 'Billing Generated', detail: 'Rent, parking, utilities, recoveries. VAT calculated. Statements produced for every tenant.' },
  { step: '03', label: 'Payments Reconciled', detail: 'Bank import matches receipts to invoices automatically. One click confirms. Cash book updated.' },
  { step: '04', label: 'Operations Completed', detail: 'Work orders assigned. Inspections filed. Supplier invoices captured and approved.' },
  { step: '05', label: 'Financial Period Closed', detail: 'Every transaction accounted for. Trial balance verified. Period closed with confidence.' },
  { step: '06', label: 'Executive Insight', detail: 'Occupancy 94%. Revenue R842k. 3 items need attention. Good morning.' },
];

export function EverythingFlows() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timers = FLOW_STEPS.map((_, i) =>
      window.setTimeout(() => setActiveStep(i), 600 + i * 200)
    );
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  return (
    <Section id="flows" className="relative overflow-hidden">
      <Container>
        <div className="text-center mb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80 mb-6 font-medium">The Solution</p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">Everything flows.</h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">From lease creation to executive insight. One platform. One source of truth.</p>
        </div>

        <div ref={sectionRef} className="relative max-w-lg mx-auto">
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/[0.04]">
            <div className="w-full bg-gradient-to-b from-amber-500/60 via-amber-500/30 to-amber-500/10 transition-all duration-[2000ms] ease-out" style={{ height: visible ? '100%' : '0%' }} />
          </div>

          <div className="space-y-12">
            {FLOW_STEPS.map((item, i) => (
              <div key={item.step} className={`group relative pl-12 transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`} style={{ transitionDelay: `${i * 200}ms` }}>
                <div className={`absolute left-0 top-1.5 w-[9px] h-[9px] rounded-full border-2 transition-all duration-500 ${activeStep >= i ? 'border-amber-500/60 bg-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'border-white/10 bg-black scale-100'}`} style={{ transitionDelay: `${i * 200 + 500}ms` }} />
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-amber-500/60 mb-1">{item.step}</p>
                <h3 className="text-lg font-light text-white group-hover:text-amber-400/80 transition-colors duration-300">{item.label}</h3>
                <p className="mt-1 text-sm text-zinc-500 font-light leading-relaxed max-w-md">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
