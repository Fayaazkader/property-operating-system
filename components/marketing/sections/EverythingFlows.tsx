'use client';

import { useState, useEffect, useRef } from 'react';
import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const columns = [
  {
    title: 'Revenue',
    items: ['Lease Management', 'Billing Rules', 'Invoice Generation', 'Escalations', 'Revenue Protection'],
    color: 'emerald',
  },
  {
    title: 'Operations',
    items: ['Maintenance', 'Inspections', 'Tasks', 'Work Orders', 'Contractors'],
    color: 'blue',
  },
  {
    title: 'Finance',
    items: ['Bank Imports', 'Reconciliation', 'Statements', 'Collections', 'Reporting'],
    color: 'amber',
  },
  {
    title: 'Communication',
    items: ['Tenant Inbox', 'WhatsApp', 'Email', 'Notices', 'Notifications'],
    color: 'purple',
  },
  {
    title: 'Governance',
    items: ['Approvals', 'Audit Trail', 'Permissions', 'Compliance', 'Activity Log'],
    color: 'slate',
  },
  {
    title: 'Intelligence',
    items: ['Portfolio KPIs', 'Occupancy', 'NOI', 'Risk', 'AI Insights'],
    color: 'rose',
  },
];

const colorMap: Record<string, { text: string; border: string; bg: string; dot: string; flow: string }> = {
  emerald: { text: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.02]', dot: 'bg-emerald-400', flow: 'bg-emerald-400/30' },
  blue: { text: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/[0.02]', dot: 'bg-blue-400', flow: 'bg-blue-400/30' },
  amber: { text: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/[0.02]', dot: 'bg-amber-400', flow: 'bg-amber-400/30' },
  purple: { text: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/[0.02]', dot: 'bg-purple-400', flow: 'bg-purple-400/30' },
  slate: { text: 'text-zinc-400', border: 'border-zinc-500/20', bg: 'bg-zinc-500/[0.02]', dot: 'bg-zinc-400', flow: 'bg-zinc-400/30' },
  rose: { text: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/[0.02]', dot: 'bg-rose-400', flow: 'bg-rose-400/30' },
};

export function EverythingFlows() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
      },
      { threshold: 0.15 }
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

        {/* Flow diagram — 3 columns × 2 rows, connected by vertical flow lines */}
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          
          {/* Row 1: Revenue → Operations → Finance */}
          <div className="grid grid-cols-3 gap-6 mb-4">
            {columns.slice(0, 3).map((col, i) => {
              const c = colorMap[col.color];
              return (
                <div
                  key={col.title}
                  className={`rounded-xl border ${c.border} ${c.bg} backdrop-blur-sm p-4 text-center transition-all duration-700`}
                  style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transitionDelay: `${0.2 + i * 0.15}s` }}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    <span className={`text-xs font-semibold ${c.text} tracking-wide`}>{col.title}</span>
                  </div>
                  <div className="w-8 h-px bg-white/[0.06] mx-auto mb-2" />
                  <div className="space-y-0.5">
                    {col.items.map(item => (
                      <p key={item} className="text-[10px] text-zinc-500 font-light">{item}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Flow arrows row 1→2 */}
          <div className="flex justify-center gap-3 mb-4" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease-out 1s' }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div className={`w-0.5 h-6 ${colorMap[columns[i].color].flow}`} />
                <div className={`w-1 h-1 rounded-full ${colorMap[columns[i].color].dot}`} />
                <div className={`w-0.5 h-6 ${colorMap[columns[i].color].flow}`} />
              </div>
            ))}
          </div>

          {/* Row 2: Governance → Platform Hub → Intelligence */}
          <div className="grid grid-cols-3 gap-6 mb-4">
            {[columns[4], null, columns[5]].map((col, i) => {
              if (!col) {
                // Center hub
                return (
                  <div
                    key="hub"
                    className="flex items-center justify-center"
                    style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease-out 1.5s' }}
                  >
                    <div className="rounded-full border border-white/10 bg-black/95 backdrop-blur-sm px-5 py-4 text-center shadow-2xl">
                      <p className="text-sm font-medium text-white tracking-tight">AssetFlow</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5 font-light">Operating Platform</p>
                      <div className="mt-2 flex items-center justify-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[8px] text-emerald-400/80 font-light">Live</span>
                      </div>
                    </div>
                  </div>
                );
              }
              const c = colorMap[col.color];
              return (
                <div
                  key={col.title}
                  className={`rounded-xl border ${c.border} ${c.bg} backdrop-blur-sm p-4 text-center transition-all duration-700`}
                  style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transitionDelay: `${0.8 + i * 0.15}s` }}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    <span className={`text-xs font-semibold ${c.text} tracking-wide`}>{col.title}</span>
                  </div>
                  <div className="w-8 h-px bg-white/[0.06] mx-auto mb-2" />
                  <div className="space-y-0.5">
                    {col.items.map(item => (
                      <p key={item} className="text-[10px] text-zinc-500 font-light">{item}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom flow — converges to center */}
          <div className="flex justify-center gap-16" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease-out 1.8s' }}>
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-0.5 h-4 bg-zinc-400/20" />
              <div className="w-1 h-1 rounded-full bg-zinc-400/40" />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-0.5 h-4 bg-zinc-400/20" />
              <div className="w-1 h-1 rounded-full bg-zinc-400/40" />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
