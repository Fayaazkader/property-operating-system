'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCommandPalette } from '@/lib/platform/CommandPaletteContext';
import Link from 'next/link';
import { 
  TrendingUp, Wrench, Zap, ClipboardCheck, FileText, Users, 
  Calendar, Building2, ArrowRight, Search, Bell, ChevronRight
} from 'lucide-react';

export default function OperationsHub() {
  const router = useRouter();
  const { open } = useCommandPalette();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [visible, setVisible] = useState(false);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/landing'); return; }
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).single();
      if (profile?.display_name) setDisplayName(profile.display_name);
      setLoading(false);
      setTimeout(() => setVisible(true), 100);
    }
    init();

    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const modules = [
    { key: 'revenue', label: 'Revenue', icon: TrendingUp, value: 'R12.4m', status: 'All billing complete', statusColor: 'text-emerald-400', href: '/financials/revenue' },
    { key: 'maintenance', label: 'Maintenance', icon: Wrench, value: '3 Open', status: '1 urgent issue', statusColor: 'text-amber-400', href: '/maintenance' },
    { key: 'utilities', label: 'Utilities', icon: Zap, value: '96%', status: 'Recovery improved +4.2%', statusColor: 'text-emerald-400', href: '/utilities' },
    { key: 'inspections', label: 'Inspections', icon: ClipboardCheck, value: '2 Due', status: 'Today', statusColor: 'text-blue-400', href: '/inspections' },
    { key: 'procurement', label: 'Procurement', icon: FileText, value: '4 RFQs', status: '1 awaiting approval', statusColor: 'text-amber-400', href: '/procurement' },
    { key: 'suppliers', label: 'Suppliers', icon: Users, value: '28 Active', status: 'All compliant', statusColor: 'text-emerald-400', href: '/suppliers' },
    { key: 'leasing', label: 'Leasing', icon: Building2, value: '6 Expiring', status: '90 day outlook', statusColor: 'text-zinc-400', href: '/leasing' },
    { key: 'calendar', label: 'Calendar', icon: Calendar, value: 'Today', status: '4 inspections · 2 visits', statusColor: 'text-zinc-400', href: '/calendar' },
  ];

  const healthBars = [
    { label: 'Revenue', pct: 94, color: 'bg-emerald-400' },
    { label: 'Maintenance', pct: 81, color: 'bg-amber-400' },
    { label: 'Compliance', pct: 90, color: 'bg-emerald-400' },
    { label: 'Utilities', pct: 97, color: 'bg-emerald-400' },
    { label: 'Procurement', pct: 74, color: 'bg-amber-400' },
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-black">
      
      {/* HERO — Minimal, confident */}
      <section className={`px-8 pt-20 pb-16 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500 mb-4">Operations Hub</p>
          <h1 className="text-4xl font-light tracking-[-0.02em] text-white leading-tight">
            {greeting}{displayName ? `, ${displayName}` : ''}.
          </h1>
          <p className="text-lg text-zinc-500 font-light mt-3 max-w-xl leading-relaxed">
            Portfolio risk is <span className="text-emerald-400">low</span>. Two items need attention.
          </p>
        </div>
      </section>

      {/* OPERATIONS MATRIX — Living tiles */}
      <section className="px-8 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-4 gap-3">
            {modules.map((mod, i) => (
              <Link
                key={mod.key}
                href={mod.href}
                className={`group relative rounded-2xl border border-white/[0.04] bg-white/[0.01] p-6 transition-all duration-500 hover:bg-white/[0.03] hover:border-white/[0.08] hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/50`}
                style={{ 
                  opacity: visible ? 1 : 0, 
                  transform: visible ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.1 + i * 0.05}s`,
                }}
                onMouseEnter={() => setHoveredModule(mod.key)}
                onMouseLeave={() => setHoveredModule(null)}
              >
                {/* Glow effect on hover */}
                <div className={`absolute inset-0 rounded-2xl transition-opacity duration-500 ${hoveredModule === mod.key ? 'opacity-100' : 'opacity-0'}`}
                  style={{ background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.03), transparent 40%)` }} />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <mod.icon className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors duration-500" />
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-400 transition-colors duration-500">{mod.label}</p>
                  </div>
                  <p className="text-2xl font-light tracking-[-0.02em] text-white mb-1">{mod.value}</p>
                  <p className={`text-[11px] font-light ${mod.statusColor} transition-all duration-500`}>{mod.status}</p>
                  
                  {/* Expand indicator */}
                  <div className={`flex items-center gap-1 mt-4 transition-all duration-500 ${hoveredModule === mod.key ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>
                    <span className="text-[10px] text-zinc-400">Open</span>
                    <ChevronRight className="w-3 h-3 text-zinc-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PORTFOLIO HEALTH — Scroll-triggered */}
      <section className={`px-8 py-16 transition-all duration-1000 ${scrollY > 200 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-8">Portfolio Health</p>
          <div className="space-y-4">
            {healthBars.map((bar, i) => (
              <div key={bar.label} className="flex items-center gap-6">
                <span className="text-xs text-zinc-400 w-28 font-light">{bar.label}</span>
                <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${bar.color} rounded-full transition-all duration-1000 ease-out`}
                    style={{ width: scrollY > 200 ? `${bar.pct}%` : '0%', transitionDelay: `${i * 0.15}s` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 w-10 text-right font-light tabular-nums">{bar.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTELLIGENCE — Narrative */}
      <section className={`px-8 py-16 transition-all duration-1000 ${scrollY > 400 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-8">Today's Story</p>
          <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-8">
            <div className="space-y-3 text-sm font-light text-zinc-400 leading-relaxed">
              <p>• Two inspections completed — no critical findings.</p>
              <p>• Water recovery improved <span className="text-emerald-400">+4.2%</span> at Rosebank Office Park.</p>
              <p>• One supplier quote overdue — <span className="text-amber-400">ABC Mechanical</span>.</p>
              <p>• Lease <span className="text-zinc-300">L-2084</span> expires in 12 days.</p>
              <p>• Procurement awaiting <span className="text-amber-400">1 approval</span>.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TIMELINE — Cross-module */}
      <section className={`px-8 py-16 transition-all duration-1000 ${scrollY > 600 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-8">Activity Timeline</p>
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.04]" />
            <div className="space-y-5">
              {[
                { time: '09:20', event: 'Tenant notified', module: 'communications', detail: 'Lease renewal reminder sent' },
                { time: '09:16', event: 'Morning Brief updated', module: 'intelligence', detail: 'Portfolio risk recalculated' },
                { time: '09:14', event: 'Revenue updated', module: 'revenue', detail: 'Recovery improved at Rosebank' },
                { time: '09:11', event: 'Recovery recalculated', module: 'utilities', detail: 'Water allocation adjusted' },
                { time: '09:02', event: 'Maintenance completed', module: 'maintenance', detail: 'Plumbing repair — Building A' },
              ].map((item, i) => (
                <div key={i} className="relative pl-8">
                  <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-black ${
                    item.module === 'revenue' ? 'bg-emerald-400' :
                    item.module === 'maintenance' ? 'bg-amber-400' :
                    item.module === 'utilities' ? 'bg-blue-400' :
                    item.module === 'communications' ? 'bg-purple-400' : 'bg-zinc-500'
                  }`} />
                  <p className="text-[11px] text-zinc-600">{item.time}</p>
                  <p className="text-sm text-white font-light mt-0.5">{item.event}</p>
                  <p className="text-[11px] text-zinc-500 font-light mt-0.5">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SEARCH */}
      <section className="px-8 py-12 pb-24">
        <div className="max-w-6xl mx-auto">
          <button 
            onClick={open}
            className="w-full rounded-xl border border-white/[0.05] bg-white/[0.01] px-5 py-4 text-sm text-zinc-500 text-left hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300 font-light"
          >
            <Search className="w-4 h-4 inline-block mr-2 text-zinc-600" />
            Search anything across your portfolio...
          </button>
        </div>
      </section>
    </div>
  );
}
