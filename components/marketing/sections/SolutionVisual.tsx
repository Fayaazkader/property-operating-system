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
  const [phase, setPhase] = useState<'idle' | 'lines' | 'hub' | 'lifecycle'>('idle');
  const visualRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase('lines');
        }
      },
      { threshold: 0.2 }
    );

    const handleScroll = () => {
      if (!visualRef.current) return;
      const rect = visualRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      // How far into view (0 = just entered, 1 = fully passed)
      const progress = Math.max(0, Math.min(1, (windowHeight - rect.top) / (windowHeight + rect.height)));
      setScrollProgress(progress);
    };

    if (visualRef.current) {
      observer.observe(visualRef.current);
      window.addEventListener('scroll', handleScroll, { passive: true });
    }
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Trigger hub when lines reach ~80% drawn
  useEffect(() => {
    if (scrollProgress > 0.6 && phase === 'lines') {
      setPhase('hub');
    }
    if (scrollProgress > 0.85 && phase === 'hub') {
      setPhase('lifecycle');
    }
  }, [scrollProgress, phase]);

  // Hub center coordinates
  const hubCX = 370;
  const hubCY = 270;

  // Card positions — where each card is placed
  const cards = [
    { Component: LeaseRegisterCard, left: 30, top: 10, width: 230, height: 130 },
    { Component: BillingCard, left: 460, top: 15, width: 210, height: 140 },
    { Component: BankFeedCard, left: 0, top: 220, width: 220, height: 130 },
    { Component: MaintenanceCard, left: 480, top: 230, width: 220, height: 130 },
    { Component: ExecutiveReportCard, left: 30, top: 410, width: 230, height: 120 },
    { Component: TenantInboxCard, left: 460, top: 380, width: 210, height: 120 },
  ];

  // Calculate line endpoints from inner edge of each card toward hub
  const getLineEndpoint = (card: typeof cards[0]) => {
    const cardCX = card.left + card.width / 2;
    const cardCY = card.top + card.height / 2;
    
    // Direction from card center to hub center
    const dx = hubCX - cardCX;
    const dy = hubCY - cardCY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Start from the inner edge of the card (closest to hub)
    const startX = cardCX + (dx / dist) * (Math.min(card.width, card.height) / 2 + 5);
    const startY = cardCY + (dy / dist) * (Math.min(card.width, card.height) / 2 + 5);
    
    return { x1: startX, y1: startY, x2: hubCX, y2: hubCY };
  };

  const lines = cards.map(card => getLineEndpoint(card));

  // Line draw progress based on scroll
  const lineProgress = Math.min(1, scrollProgress * 1.6);

  return (
    <div ref={visualRef} className="solution-visual" style={{ position: 'relative', height: '600px', maxWidth: '740px', margin: '0 auto', overflow: 'hidden' }}>
      
      {/* Connection lines — draw from card edges toward center as you scroll */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 740 600" style={{ zIndex: 5 }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {lines.map((line, i) => (
          <line
            key={i}
            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            stroke={phase === 'hub' || phase === 'lifecycle' ? 'rgba(16,185,129,0.5)' : 'rgba(16,185,129,0.15)'}
            strokeWidth={phase === 'hub' || phase === 'lifecycle' ? '1.5' : '1'}
            strokeDasharray="400"
            strokeDashoffset={400 - (lineProgress * 400)}
            filter={phase === 'hub' || phase === 'lifecycle' ? 'url(#glow)' : 'none'}
            style={{ transition: 'stroke 0.8s ease-out, strokeWidth 0.8s ease-out' }}
          />
        ))}
      </svg>

      {/* Cards */}
      {cards.map(({ Component, left, top }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left,
            top,
            opacity: 1,
            transform: `scale(0.75)`,
            zIndex: 10,
          }}
        >
          <Component scale={0.75} />
        </div>
      ))}

      {/* Hub — lights up when lines connect */}
      <div
        style={{
          position: 'absolute',
          top: `${hubCY}px`,
          left: `${hubCX}px`,
          transform: (phase === 'hub' || phase === 'lifecycle') ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.6)',
          opacity: (phase === 'hub' || phase === 'lifecycle') ? 1 : 0.3,
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 30,
        }}
      >
        <div className={`rounded-2xl border bg-black/95 backdrop-blur-md px-6 py-4 text-center shadow-2xl transition-all duration-700 ${
          phase === 'hub' || phase === 'lifecycle' 
            ? 'border-emerald-400/30 shadow-emerald-500/20' 
            : 'border-white/10 shadow-black/50'
        }`}>
          <Image src="/logo.png" alt="AssetFlow" width={32} height={32} className="mx-auto mb-2 rounded-md" />
          <p className="text-sm font-medium text-white tracking-tight">AssetFlow</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 font-light">Operating Platform</p>
          {(phase === 'hub' || phase === 'lifecycle') && (
            <div className="mt-2 flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8px] text-emerald-400/80 font-light">Connected</span>
            </div>
          )}
        </div>
      </div>

      {/* Lifecycle */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: phase === 'lifecycle' ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(30px)',
          opacity: phase === 'lifecycle' ? 1 : 0,
          transition: 'all 0.8s ease-out 0.3s',
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
