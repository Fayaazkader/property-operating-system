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
          setTimeout(() => setPhase('hub'), 2000);
          setTimeout(() => setPhase('lifecycle'), 3500);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (visualRef.current) observer.observe(visualRef.current);
    return () => observer.disconnect();
  }, []);

  const isActive = phase !== 'idle';

  return (
    <div ref={visualRef} className="solution-visual" style={{ position: 'relative', height: '650px', maxWidth: '780px', margin: '0 auto', overflow: 'hidden' }}>
      
      {/* Connection lines */}
      {isActive && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 780 600" style={{ zIndex: 5 }}>
          <line x1="240" y1="160" x2="360" y2="270" stroke={phase === "hub" || phase === "lifecycle" ? "rgba(16,185,129,0.6)" : "rgba(16,185,129,0.15)"} strokeWidth={phase === "hub" || phase === "lifecycle" ? "2" : "1"} className="connect-line" strokeDasharray="400" strokeDashoffset="0">
            <animate attributeName="stroke-dashoffset" from="400" to="0" dur="1.5s" begin="0.3s" fill="freeze" />
          </line>
          <line x1="520" y1="170" x2="400" y2="270" stroke={phase === "hub" || phase === "lifecycle" ? "rgba(16,185,129,0.6)" : "rgba(16,185,129,0.15)"} strokeWidth={phase === "hub" || phase === "lifecycle" ? "2" : "1"} className="connect-line" strokeDasharray="400" strokeDashoffset="0">
            <animate attributeName="stroke-dashoffset" from="400" to="0" dur="1.5s" begin="0.5s" fill="freeze" />
          </line>
          <line x1="230" y1="310" x2="360" y2="290" stroke={phase === "hub" || phase === "lifecycle" ? "rgba(16,185,129,0.6)" : "rgba(16,185,129,0.15)"} strokeWidth={phase === "hub" || phase === "lifecycle" ? "2" : "1"} className="connect-line" strokeDasharray="400" strokeDashoffset="0">
            <animate attributeName="stroke-dashoffset" from="400" to="0" dur="1.5s" begin="0.4s" fill="freeze" />
          </line>
          <line x1="530" y1="320" x2="400" y2="290" stroke={phase === "hub" || phase === "lifecycle" ? "rgba(16,185,129,0.6)" : "rgba(16,185,129,0.15)"} strokeWidth={phase === "hub" || phase === "lifecycle" ? "2" : "1"} className="connect-line" strokeDasharray="400" strokeDashoffset="0">
            <animate attributeName="stroke-dashoffset" from="400" to="0" dur="1.5s" begin="0.6s" fill="freeze" />
          </line>
          <line x1="240" y1="440" x2="360" y2="310" stroke={phase === "hub" || phase === "lifecycle" ? "rgba(16,185,129,0.6)" : "rgba(16,185,129,0.15)"} strokeWidth={phase === "hub" || phase === "lifecycle" ? "2" : "1"} className="connect-line" strokeDasharray="400" strokeDashoffset="0">
            <animate attributeName="stroke-dashoffset" from="400" to="0" dur="1.5s" begin="0.5s" fill="freeze" />
          </line>
          <line x1="520" y1="450" x2="400" y2="310" stroke={phase === "hub" || phase === "lifecycle" ? "rgba(16,185,129,0.6)" : "rgba(16,185,129,0.15)"} strokeWidth={phase === "hub" || phase === "lifecycle" ? "2" : "1"} className="connect-line" strokeDasharray="400" strokeDashoffset="0">
            <animate attributeName="stroke-dashoffset" from="400" to="0" dur="1.5s" begin="0.7s" fill="freeze" />
          </line>
          {phase === 'hub' && (
            <circle cx="380" cy="290" r="30" fill="none" stroke="rgba(16,185,129,0.4)" strokeWidth="1.5" opacity="0">
              <animate attributeName="r" from="30" to="110" dur="2.5s" begin="0s" fill="freeze" />
              <animate attributeName="opacity" from="0.8" to="0" dur="2.5s" begin="0s" fill="freeze" />
            </circle>
          )}
        </svg>
      )}

      {/* Cards — render directly, no wrapper positioning */}
      <div style={{ opacity: isActive ? 1 : 0.6, transition: 'opacity 0.6s' }}>
        <LeaseRegisterCard scale={0.75} />
      </div>
      <div style={{ opacity: isActive ? 1 : 0.6, transition: 'opacity 0.6s 0.1s' }}>
        <BillingCard scale={0.75} />
      </div>
      <div style={{ opacity: isActive ? 1 : 0.6, transition: 'opacity 0.6s 0.15s' }}>
        <BankFeedCard scale={0.75} />
      </div>
      <div style={{ opacity: isActive ? 1 : 0.6, transition: 'opacity 0.6s 0.2s' }}>
        <MaintenanceCard scale={0.75} />
      </div>
      <div style={{ opacity: isActive ? 1 : 0.6, transition: 'opacity 0.6s 0.25s' }}>
        <ExecutiveReportCard scale={0.75} />
      </div>
      <div style={{ opacity: isActive ? 1 : 0.6, transition: 'opacity 0.6s 0.3s' }}>
        <TenantInboxCard scale={0.75} />
      </div>

      {/* Hub */}
      <div
        style={{
          position: 'absolute',
          top: '285px',
          left: '380px',
          transform: (phase === 'hub' || phase === 'lifecycle') ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
          opacity: (phase === 'hub' || phase === 'lifecycle') ? 1 : 0,
          transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 30,
        }}
      >
        <div className="rounded-2xl border border-emerald-500/30 bg-black/95 backdrop-blur-md px-6 py-4 text-center shadow-2xl shadow-emerald-500/10">
          <Image src="/logo.png" alt="AssetFlow" width={32} height={32} className="mx-auto mb-2 rounded-md" />
          <p className="text-sm font-medium text-white tracking-tight">AssetFlow</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 font-light">Operating Platform</p>
        </div>
      </div>

      {/* Lifecycle */}
      <div
        style={{
          position: 'absolute',
          bottom: '-16px',
          left: '50%',
          transform: phase === 'lifecycle' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(40px)',
          opacity: 1, zIndex: 25,
          transition: 'all 0.8s ease-out 0.5s',
          zIndex: 25,
        }}
      >
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-medium">The Complete Lifecycle</p>
        <div className="flex items-center gap-1">
          {['Lease', 'Billing', 'Payments', 'Reconciliation', 'Intelligence'].map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.04] px-2.5 py-1 text-[9px] text-emerald-300 font-light whitespace-nowrap">
                {step}
              </div>
              {i < 4 && <span className="text-emerald-600 text-[10px] font-light">→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
