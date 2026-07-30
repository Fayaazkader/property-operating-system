'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { LeaseRegisterCard } from './problem-cards/LeaseRegisterCard';
import { BillingCard } from './problem-cards/BillingCard';
import { BankFeedCard } from './problem-cards/BankFeedCard';
import { MaintenanceCard } from './problem-cards/MaintenanceCard';
import { ExecutiveReportCard } from './problem-cards/ExecutiveReportCard';
import { TenantInboxCard } from './problem-cards/TenantInboxCard';

const cardPositions = [
  { Component: LeaseRegisterCard, left: 0, top: 0, delay: 0.2 },
  { Component: BillingCard, left: 560, top: -20, delay: 0.4 },
  { Component: BankFeedCard, left: 100, top: 260, delay: 0.6 },
  { Component: MaintenanceCard, left: 540, top: 300, delay: 0.8 },
  { Component: ExecutiveReportCard, left: 10, top: 460, delay: 1.0 },
  { Component: TenantInboxCard, left: 470, top: 500, delay: 1.2 },
];

export function SolutionVisual() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative h-[580px] md:h-[680px] max-w-4xl mx-auto solution-visual ${visible ? 'visible' : ''}`}>
      
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 600">
        <line x1="160" y1="100" x2="400" y2="280" className="connect-line" />
        <line x1="670" y1="80" x2="400" y2="280" className="connect-line" />
        <line x1="230" y1="340" x2="400" y2="280" className="connect-line" />
        <line x1="650" y1="390" x2="400" y2="280" className="connect-line" />
        <line x1="150" y1="540" x2="400" y2="280" className="connect-line" />
        <line x1="580" y1="570" x2="400" y2="280" className="connect-line" />
        <circle cx="400" cy="280" r="60" fill="none" className="pulse-ring" />
        <circle cx="400" cy="280" r="75" fill="none" stroke="rgba(16,185,129,0.1)" strokeWidth="0.5" />
        <circle cx="400" cy="280" r="90" fill="none" stroke="rgba(16,185,129,0.05)" strokeWidth="0.5" />
      </svg>

      {/* Cards */}
      {cardPositions.map(({ Component, left, top, delay }, i) => (
        <div
          key={i}
          className="transition-all duration-1000"
          style={{
            position: 'absolute',
            left,
            top,
            transform: `scale(0.85)`,
            opacity: visible ? 1 : 0,
            transitionDelay: `${delay}s`,
          }}
        >
          <Component />
        </div>
      ))}

      {/* Hub */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-700"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          transitionDelay: '1.5s',
        }}
      >
        <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.04] to-emerald-500/[0.01] backdrop-blur-sm px-10 py-8 text-center shadow-2xl shadow-emerald-500/5">
          <Image src="/logo.png" alt="AssetFlow" width={40} height={40} className="mx-auto mb-4 rounded-lg" />
          <p className="text-lg font-medium text-white tracking-tight">AssetFlow</p>
          <p className="text-[10px] text-zinc-500 mt-1 font-light">Operational Platform</p>
          <div className="mt-4 space-y-0.5 text-[10px]">
            <div className="flex items-center justify-center gap-2"><span className="text-emerald-400 text-xs">✓</span><span className="text-zinc-400 font-light">Leases</span></div>
            <div className="flex items-center justify-center gap-2"><span className="text-emerald-400 text-xs">✓</span><span className="text-zinc-400 font-light">Billing</span></div>
            <div className="flex items-center justify-center gap-2"><span className="text-emerald-400 text-xs">✓</span><span className="text-zinc-400 font-light">Bank</span></div>
            <div className="flex items-center justify-center gap-2"><span className="text-emerald-400 text-xs">✓</span><span className="text-zinc-400 font-light">Maintenance</span></div>
            <div className="flex items-center justify-center gap-2"><span className="text-emerald-400 text-xs">✓</span><span className="text-zinc-400 font-light">Communication</span></div>
            <div className="flex items-center justify-center gap-2"><span className="text-emerald-400 text-xs">✓</span><span className="text-zinc-400 font-light">Reporting</span></div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[9px] text-emerald-400/80 font-light">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
