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
          setTimeout(() => setPhase('lifecycle'), 3200);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (visualRef.current) observer.observe(visualRef.current);
    return () => observer.disconnect();
  }, []);

  const isActive = phase !== 'idle';

  // Cards arranged in a circle around the hub — start far, end closer
  const cards = [
    { Component: LeaseRegisterCard, startX: -100, startY: -100, endX: 50, endY: 20 },
    { Component: BillingCard, startX: 500, startY: -120, endX: 460, endY: 20 },
    { Component: BankFeedCard, startX: -80, startY: 300, endX: 20, endY: 240 },
    { Component: MaintenanceCard, startX: 500, startY: 320, endX: 480, endY: 240 },
    { Component: ExecutiveReportCard, startX: -60, startY: 520, endX: 50, endY: 460 },
    { Component: TenantInboxCard, startX: 480, startY: 540, endX: 460, endY: 460 },
  ];

  // Hub center point
  const hubX = 290;
  const hubY = 250;

  // Lines from each card's center to the hub
  const lines = [
    { x1: 160, y1: 90, x2: hubX, y2: hubY },
    { x1: 570, y1: 90, x2: hubX, y2: hubY },
    { x1: 130, y1: 310, x2: hubX, y2: hubY },
    { x1: 590, y1: 310, x2: hubX, y2: hubY },
    { x1: 160, y1: 530, x2: hubX, y2: hubY },
    { x1: 570, y1: 530, x2: hubX, y2: hubY },
  ];

  return (
    <div ref={visualRef} className="solution-visual" style={{ position: 'relative', height: '650px', maxWidth: '800px', margin: '0 auto', overflow: 'hidden' }}>
      
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 720 620" style={{ zIndex: 5 }}>
        {lines.map((line, i) => (
          <line
            key={i}
            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            stroke="rgba(16,185,129,0.25)"
            strokeWidth="1"
            strokeDasharray="500"
            strokeDashoffset={isActive ? '0' : '500'}
            style={{ transition: `stroke-dashoffset 1.8s ease-out ${0.4 + i * 0.12}s` }}
          />
        ))}
        {/* Pulse */}
        {phase === 'hub' && (
          <circle cx={hubX} cy={hubY} r="30" fill="none" stroke="rgba(16,185,129,0.4)" strokeWidth="1.5">
            <animate attributeName="r" from="30" to="100" dur="2.5s" repeatCount="1" fill="freeze" />
            <animate attributeName="opacity" from="0.8" to="0" dur="2.5s" repeatCount="1" fill="freeze" />
          </circle>
        )}
      </svg>

      {/* Cards — glide inward, always visible */}
      {cards.map(({ Component, startX, startY, endX, endY }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: isActive ? endX : startX,
            top: isActive ? endY : startY,
            opacity: 1,
            transform: 'scale(0.8)',
            transition: `all 1.6s cubic-bezier(0.22, 0.61, 0.36, 1) ${i * 0.1}s`,
            zIndex: 10,
          }}
        >
          <Component scale={0.8} />
        </div>
      ))}

      {/* Hub — fades in after lines draw */}
      <div
        style={{
          position: 'absolute',
          top: `${hubY}px`,
          left: `${hubX}px`,
          transform: (phase === 'hub' || phase === 'lifecycle') ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
          opacity: (phase === 'hub' || phase === 'lifecycle') ? 1 : 0,
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 30,
        }}
      >
        <div className="rounded-2xl border border-emerald-500/20 bg-black/90 backdrop-blur-md px-7 py-5 text-center shadow-2xl shadow-emerald-500/10">
          <Image src="/logo.png" alt="AssetFlow" width={36} height={36} className="mx-auto mb-2 rounded-md" />
          <p className="text-sm font-medium text-white tracking-tight">AssetFlow</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 font-light">Operating Platform</p>
        </div>
      </div>

      {/* Lifecycle */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: phase === 'lifecycle' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(40px)',
          opacity: phase === 'lifecycle' ? 1 : 0,
          transition: 'all 1s ease-out 0.6s',
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
