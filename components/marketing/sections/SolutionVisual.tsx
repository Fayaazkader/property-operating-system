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
          // Phase 1: Cards crash in
          setPhase('crash');
          // Phase 2: Hub appears
          setTimeout(() => setPhase('hub'), 1200);
          // Phase 3: Lifecycle
          setTimeout(() => setPhase('lifecycle'), 2400);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (visualRef.current) observer.observe(visualRef.current);
    return () => observer.disconnect();
  }, []);

  const isActive = phase !== 'idle';

  // Card positions: start scattered, end at center
  const cards = [
    { Component: LeaseRegisterCard, startX: -120, startY: -120, endX: 270, endY: 170 },
    { Component: BillingCard, startX: 520, startY: -140, endX: 320, endY: 170 },
    { Component: BankFeedCard, startX: -80, startY: 300, endX: 270, endY: 220 },
    { Component: MaintenanceCard, startX: 500, startY: 320, endX: 320, endY: 220 },
    { Component: ExecutiveReportCard, startX: -60, startY: 520, endX: 270, endY: 270 },
    { Component: TenantInboxCard, startX: 460, startY: 540, endX: 320, endY: 270 },
  ];

  return (
    <div ref={visualRef} className="solution-visual" style={{ position: 'relative', height: '620px', maxWidth: '800px', margin: '0 auto', overflow: 'hidden' }}>
      
      {/* Connection lines — fade out as cards converge */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 600">
        <line x1="150" y1="90" x2="400" y2="280" className="connect-line" style={{ opacity: phase === 'crash' ? 1 : phase === 'idle' ? 0 : 0, transition: 'opacity 0.3s' }} />
        <line x1="660" y1="70" x2="400" y2="280" className="connect-line" style={{ opacity: phase === 'crash' ? 1 : 0, transition: 'opacity 0.3s' }} />
        <line x1="220" y1="330" x2="400" y2="280" className="connect-line" style={{ opacity: phase === 'crash' ? 1 : 0, transition: 'opacity 0.3s' }} />
        <line x1="640" y1="380" x2="400" y2="280" className="connect-line" style={{ opacity: phase === 'crash' ? 1 : 0, transition: 'opacity 0.3s' }} />
        <line x1="140" y1="530" x2="400" y2="280" className="connect-line" style={{ opacity: phase === 'crash' ? 1 : 0, transition: 'opacity 0.3s' }} />
        <line x1="570" y1="560" x2="400" y2="280" className="connect-line" style={{ opacity: phase === 'crash' ? 1 : 0, transition: 'opacity 0.3s' }} />
      </svg>

      {/* Cards — crash into center */}
      {cards.map(({ Component, startX, startY, endX, endY }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: phase === 'idle' ? startX : endX,
            top: phase === 'idle' ? startY : endY,
            opacity: phase === 'crash' ? 0 : phase === 'idle' ? 1 : 0,
            transform: `scale(${phase === 'crash' ? 0.3 : 0.85})`,
            transition: phase === 'crash' 
              ? `all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${i * 0.08}s` 
              : 'all 0.6s ease-out',
            zIndex: phase === 'crash' ? 10 : 1,
            pointerEvents: 'none',
          }}
        >
          <Component scale={0.85} />
        </div>
      ))}

      {/* Hub — appears after crash */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: phase === 'hub' || phase === 'lifecycle' ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
          opacity: phase === 'hub' || phase === 'lifecycle' ? 1 : 0,
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
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

      {/* Lifecycle — appears below hub */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: phase === 'lifecycle' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(40px)',
          opacity: phase === 'lifecycle' ? 1 : 0,
          transition: 'all 0.8s ease-out 0.3s',
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
