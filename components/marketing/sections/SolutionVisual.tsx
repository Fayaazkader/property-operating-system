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
  const [phase, setPhase] = useState<'idle' | 'connect' | 'hub' | 'lifecycle'>('idle');
  const visualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase('connect');
          setTimeout(() => setPhase('hub'), 1800);
          setTimeout(() => setPhase('lifecycle'), 3000);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (visualRef.current) observer.observe(visualRef.current);
    return () => observer.disconnect();
  }, []);

  const isActive = phase !== 'idle';

  // Cards start scattered, glide inward ~25%
  const cards = [
    { Component: LeaseRegisterCard, startX: -60, startY: -60, endX: 20, endY: -20 },
    { Component: BillingCard, startX: 460, startY: -80, endX: 350, endY: -30 },
    { Component: BankFeedCard, startX: -40, startY: 260, endX: 10, endY: 200 },
    { Component: MaintenanceCard, startX: 440, startY: 280, endX: 360, endY: 220 },
    { Component: ExecutiveReportCard, startX: -20, startY: 480, endX: 30, endY: 400 },
    { Component: TenantInboxCard, startX: 420, startY: 500, endX: 340, endY: 420 },
  ];

  // Line coordinates: from card center to hub center
  const lines = [
    { x1: 130, y1: 80, x2: 380, y2: 260 },
    { x1: 580, y1: 70, x2: 400, y2: 260 },
    { x1: 140, y1: 340, x2: 380, y2: 280 },
    { x1: 570, y1: 360, x2: 400, y2: 280 },
    { x1: 130, y1: 540, x2: 380, y2: 300 },
    { x1: 550, y1: 560, x2: 400, y2: 300 },
  ];

  return (
    <div ref={visualRef} className="solution-visual" style={{ position: 'relative', height: '620px', maxWidth: '800px', margin: '0 auto', overflow: 'hidden' }}>
      
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 720 600">
        {lines.map((line, i) => (
          <line
            key={i}
            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            className="connect-line"
            style={{
              strokeDasharray: '400',
              strokeDashoffset: isActive ? '0' : '400',
              transition: `stroke-dashoffset 1.5s ease-out ${0.3 + i * 0.1}s`,
            }}
          />
        ))}
        {/* Pulse ring — travels outward */}
        {phase === 'hub' && (
          <circle cx="390" cy="270" r="50" fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth="1.5" opacity="0.6">
            <animate attributeName="r" from="50" to="120" dur="2s" repeatCount="1" fill="freeze" />
            <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="1" fill="freeze" />
          </circle>
        )}
        <circle cx="390" cy="270" r="40" fill="none" stroke="rgba(16,185,129,0.08)" strokeWidth="0.5" />
        <circle cx="390" cy="270" r="65" fill="none" stroke="rgba(16,185,129,0.05)" strokeWidth="0.5" />
      </svg>

      {/* Cards — glide inward, stay visible */}
      {cards.map(({ Component, startX, startY, endX, endY }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: isActive ? endX : startX,
            top: isActive ? endY : startY,
            opacity: 1,
            transform: 'scale(0.85)',
            transition: `all 1.5s cubic-bezier(0.22, 0.61, 0.36, 1) ${i * 0.1}s`,
            zIndex: 10,
          }}
        >
          <Component scale={0.85} />
        </div>
      ))}

      {/* Hub */}
      <div
        style={{
          position: 'absolute',
          top: '260px',
          left: '390px',
          transform: phase === 'hub' || phase === 'lifecycle' ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
          opacity: phase === 'hub' || phase === 'lifecycle' ? 1 : 0,
          transition: 'all 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 30,
        }}
      >
        <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-emerald-500/[0.02] backdrop-blur-sm px-8 py-6 text-center shadow-2xl shadow-emerald-500/10">
          <Image src="/logo.png" alt="AssetFlow" width={40} height={40} className="mx-auto mb-3 rounded-lg" />
          <p className="text-base font-medium text-white tracking-tight">AssetFlow</p>
          <p className="text-[9px] text-zinc-400 mt-0.5 font-light">Operational Platform</p>
          <div className="mt-3 space-y-0.5 text-[9px]">
            {['Leases', 'Billing', 'Bank', 'Maintenance', 'Communication', 'Reporting'].map(item => (
              <div key={item} className="flex items-center justify-center gap-1.5">
                <span className="text-emerald-400 text-[10px]">✓</span>
                <span className="text-zinc-400 font-light">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lifecycle */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: phase === 'lifecycle' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(40px)',
          opacity: phase === 'lifecycle' ? 1 : 0,
          transition: 'all 1s ease-out 0.5s',
          zIndex: 25,
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
