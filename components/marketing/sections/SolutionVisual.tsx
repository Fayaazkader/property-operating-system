'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { LeaseRegisterCard } from './problem-cards/LeaseRegisterCard';
import { BillingCard } from './problem-cards/BillingCard';
import { BankFeedCard } from './problem-cards/BankFeedCard';
import { MaintenanceCard } from './problem-cards/MaintenanceCard';
import { ExecutiveReportCard } from './problem-cards/ExecutiveReportCard';
import { TenantInboxCard } from './problem-cards/TenantInboxCard';

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

  const cards = [
    { Component: LeaseRegisterCard, left: -10, top: -10 },
    { Component: BillingCard, left: 540, top: -30 },
    { Component: BankFeedCard, left: 90, top: 250 },
    { Component: MaintenanceCard, left: 530, top: 290 },
    { Component: ExecutiveReportCard, left: 0, top: 450 },
    { Component: TenantInboxCard, left: 460, top: 490 },
  ];

  return (
    <div ref={ref} className={`relative h-[580px] md:h-[680px] max-w-4xl mx-auto solution-visual ${visible ? 'visible' : ''}`}>
      
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 600">
        <line x1="150" y1="90" x2="400" y2="280" className="connect-line" style={{ transitionDelay: '0.2s' }} />
        <line x1="660" y1="70" x2="400" y2="280" className="connect-line" style={{ transitionDelay: '0.4s' }} />
        <line x1="220" y1="330" x2="400" y2="280" className="connect-line" style={{ transitionDelay: '0.6s' }} />
        <line x1="640" y1="380" x2="400" y2="280" className="connect-line" style={{ transitionDelay: '0.8s' }} />
        <line x1="140" y1="530" x2="400" y2="280" className="connect-line" style={{ transitionDelay: '1.0s' }} />
        <line x1="570" y1="560" x2="400" y2="280" className="connect-line" style={{ transitionDelay: '1.2s' }} />
        <circle cx="400" cy="280" r="60" fill="none" className="pulse-ring" />
        <circle cx="400" cy="280" r="75" fill="none" stroke="rgba(16,185,129,0.1)" strokeWidth="0.5" />
        <circle cx="400" cy="280" r="90" fill="none" stroke="rgba(16,185,129,0.05)" strokeWidth="0.5" />
      </svg>

      {cards.map(({ Component, left, top }, i) => (
        <div
          key={i}
          className="transition-all duration-1000"
          style={{
            position: 'absolute',
            left,
            top,
            opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(0.85)' : 'translateY(12px) scale(0.85)',
            transitionDelay: `${0.2 + i * 0.2}s`,
          }}
        >
          <div style={{ transform: 'scale(0.85)' }}><Component /></div>
        </div>
      ))}

      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-700"
        style={{
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(0.85)' : 'translateY(12px) scale(0.85)',
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          transitionDelay: '1.5s',
        }}
      >
        <div className={`rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.04] to-emerald-500/[0.01] backdrop-blur-sm px-10 py-8 text-center shadow-2xl shadow-emerald-500/5 transition-all duration-1000 ${visible ? 'hub-pulse' : ''}`}>
          <Image src="/logo.png" alt="AssetFlow" width={40} height={40} className="mx-auto mb-4 rounded-lg" />
          <p className="text-lg font-medium text-white tracking-tight">AssetFlow</p>
          <p className="text-[10px] text-zinc-500 mt-1 font-light">Operational Platform</p>
          <div className="mt-4 space-y-0.5 text-[10px]">
            {['Leases', 'Billing', 'Bank', 'Maintenance', 'Communication', 'Reporting'].map(item => (
              <div key={item} className="flex items-center justify-center gap-2">
                <span className="text-emerald-400 text-xs">✓</span>
                <span className="text-zinc-400 font-light">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-emerald-400/80 font-light">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
