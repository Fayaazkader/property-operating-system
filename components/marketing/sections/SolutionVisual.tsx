'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { LeaseRegisterCard } from './problem-cards/LeaseRegisterCard';
import { BillingCard } from './problem-cards/BillingCard';
import { BankFeedCard } from './problem-cards/BankFeedCard';
import { MaintenanceCard } from './problem-cards/MaintenanceCard';
import { ExecutiveReportCard } from './problem-cards/ExecutiveReportCard';
import { TenantInboxCard } from './problem-cards/TenantInboxCard';

export function SolutionVisual() {
  const [phase, setPhase] = useState<'idle' | 'crash' | 'hub' | 'lifecycle'>('idle');
  const visualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase('crash');
          setTimeout(() => setPhase('hub'), 2500);
          setTimeout(() => setPhase('lifecycle'), 4000);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (visualRef.current) observer.observe(visualRef.current);
    return () => observer.disconnect();
  }, []);

  const cards = [
    { Component: LeaseRegisterCard, startX: -80, startY: -100, endX: 270, endY: 170 },
    { Component: BillingCard, startX: 480, startY: -120, endX: 320, endY: 170 },
    { Component: BankFeedCard, startX: -60, startY: 280, endX: 270, endY: 220 },
    { Component: MaintenanceCard, startX: 460, startY: 300, endX: 320, endY: 220 },
    { Component: ExecutiveReportCard, startX: -40, startY: 500, endX: 270, endY: 270 },
    { Component: TenantInboxCard, startX: 440, startY: 520, endX: 320, endY: 270 },
  ];

  return (
    <div ref={visualRef} className="solution-visual" style={{ position: 'relative', height: '620px', maxWidth: '800px', margin: '0 auto', overflow: 'hidden' }}>
      
      {/* Cards */}
      {cards.map(({ Component, startX, startY, endX, endY }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: phase === 'idle' ? startX : phase === 'crash' ? `${(startX + endX) / 2}px` : endX,
            top: phase === 'idle' ? startY : phase === 'crash' ? `${(startY + endY) / 2}px` : endY,
            opacity: phase === 'idle' ? 1 : phase === 'crash' ? 0.6 : 0,
            transform: phase === 'idle' ? 'scale(0.85)' : phase === 'crash' ? 'scale(0.5)' : 'scale(0.3)',
            transition: phase === 'crash' 
              ? `all 2.2s cubic-bezier(0.22, 0.61, 0.36, 1) ${i * 0.12}s` 
              : `all 0.6s ease-out ${i * 0.05}s`,
            zIndex: phase === 'crash' ? 10 : 1,
            pointerEvents: 'none',
          }}
        >
          <Component scale={0.85} />
        </div>
      ))}

      {/* Hub */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: phase === 'hub' || phase === 'lifecycle' ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
          opacity: phase === 'hub' || phase === 'lifecycle' ? 1 : 0,
          transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 20,
        }}
      >
        <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-emerald-500/[0.02] backdrop-blur-sm px-10 py-8 text-center shadow-2xl shadow-emerald-500/10">
          <Image src="/logo.png" alt="AssetFlow" width={48} height={48} className="mx-auto mb-4 rounded-lg" />
          <p className="text-lg font-medium text-white tracking-tight">AssetFlow</p>
          <p className="text-[10px] text-zinc-400 mt-1 font-light">Operational Platform</p>
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

      {/* Lifecycle */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: phase === 'lifecycle' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(40px)',
          opacity: phase === 'lifecycle' ? 1 : 0,
          transition: 'all 1s ease-out 0.5s',
          zIndex: 15,
        }}
      >
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-medium">The Complete Lifecycle</p>
        <div className="flex items-center gap-1">
          {['Lease', 'Billing', 'Payments', 'Reconciliation', 'Intelligence'].map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-1.5 text-[10px] text-emerald-300 font-light whitespace-nowrap">
                {step}
              </div>
              {i < 4 && <span className="text-emerald-600 text-xs font-light">→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
