'use client';

import { useState, useEffect, useRef } from 'react';
import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const domains = [
  {
    title: 'Revenue',
    items: ['Lease Management', 'Billing Rules', 'Invoice Generation', 'Escalations', 'Revenue Protection'],
    color: 'emerald',
    x: '15%', y: '5%',
  },
  {
    title: 'Operations',
    items: ['Maintenance', 'Inspections', 'Tasks', 'Work Orders', 'Contractors'],
    color: 'blue',
    x: '55%', y: '5%',
  },
  {
    title: 'Finance',
    items: ['Bank Imports', 'Reconciliation', 'Statements', 'Collections', 'Reporting'],
    color: 'amber',
    x: '75%', y: '45%',
  },
  {
    title: 'Communication',
    items: ['Tenant Inbox', 'WhatsApp', 'Email', 'Notices', 'Notifications'],
    color: 'purple',
    x: '55%', y: '75%',
  },
  {
    title: 'Governance',
    items: ['Approvals', 'Audit Trail', 'Permissions', 'Compliance', 'Activity Log'],
    color: 'slate',
    x: '15%', y: '75%',
  },
  {
    title: 'Intelligence',
    items: ['Portfolio KPIs', 'Occupancy', 'NOI', 'Risk', 'AI Insights'],
    color: 'rose',
    x: '35%', y: '45%',
  },
];

const colorMap: Record<string, { text: string; border: string; bg: string; dot: string }> = {
  emerald: { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/[0.03]', dot: 'bg-emerald-400' },
  blue: { text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/[0.03]', dot: 'bg-blue-400' },
  amber: { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/[0.03]', dot: 'bg-amber-400' },
  purple: { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/[0.03]', dot: 'bg-purple-400' },
  slate: { text: 'text-zinc-400', border: 'border-zinc-500/30', bg: 'bg-zinc-500/[0.03]', dot: 'bg-zinc-400' },
  rose: { text: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/[0.03]', dot: 'bg-rose-400' },
};

export function EverythingFlows() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
      },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Section className="relative overflow-hidden py-24">
      <Container>
        <div ref={ref} className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400/80 mb-6 font-medium">Everything Flows</p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            One platform.
            <br />
            <span className="text-zinc-400">Every operational workflow.</span>
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-sm leading-relaxed">
            AssetFlow connects revenue, operations, finance, communication, governance and intelligence into a single operational system.
          </p>
        </div>

        {/* Domains — positioned absolutely in a relative container */}
        <div style={{ position: 'relative', height: '520px', maxWidth: '700px', margin: '0 auto' }}>
          
          {/* Connection lines — simple SVG from each domain to center */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 700 520" style={{ zIndex: 1 }}>
            {[
              { x1: 120, y1: 80, x2: 350, y2: 260 },
              { x1: 400, y1: 80, x2: 350, y2: 260 },
              { x1: 520, y1: 280, x2: 350, y2: 260 },
              { x1: 400, y1: 420, x2: 350, y2: 260 },
              { x1: 120, y1: 420, x2: 350, y2: 260 },
              { x1: 260, y1: 280, x2: 350, y2: 260 },
            ].map((line, i) => (
              <line
                key={i}
                x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
                strokeDasharray="300"
                strokeDashoffset={visible ? 0 : 300}
                style={{ transition: `stroke-dashoffset 2s ease-out ${0.3 + i * 0.15}s` }}
              />
            ))}
          </svg>

          {/* Domains */}
          {domains.map((domain, i) => {
            const c = colorMap[domain.color];
            return (
              <div
                key={domain.title}
                style={{
                  position: 'absolute',
                  left: domain.x,
                  top: domain.y,
                  transform: 'translate(-50%, -50%)',
                  opacity: visible ? 1 : 0,
                  transition: `opacity 0.6s ease-out ${0.2 + i * 0.1}s, transform 0.6s ease-out ${0.2 + i * 0.1}s`,
                  zIndex: 10,
                }}
              >
                <div className={`rounded-xl border ${c.border} ${c.bg} backdrop-blur-sm px-4 py-3 text-center min-w-[140px]`}>
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    <span className={`text-xs font-medium ${c.text}`}>{domain.title}</span>
                  </div>
                  <div className="space-y-0.5">
                    {domain.items.map(item => (
                      <p key={item} className="text-[10px] text-zinc-500 font-light">{item}</p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Center hub */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: visible ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.8)',
              opacity: visible ? 1 : 0,
              transition: 'all 0.8s ease-out 1.2s',
              zIndex: 20,
            }}
          >
            <div className="rounded-full border border-white/10 bg-black/90 backdrop-blur-sm px-5 py-3 text-center">
              <span className="text-xs font-medium text-white tracking-wide">AssetFlow</span>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
