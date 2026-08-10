'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, DollarSign, Building2, Clock, Activity, Zap, FileText, X } from 'lucide-react';
import Link from 'next/link';

export default function RecoveryCaseWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  const [recovery, setRecovery] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: rec } = await supabase.from('recoveries').select('*').eq('id', id).single();
      setRecovery(rec);
      if (rec?.property_id) {
        const { data: prop } = await supabase.from('properties').select('property_name').eq('id', rec.property_id).single();
        setProperty(prop);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;
  if (!recovery) return <div className="p-20 text-zinc-500 text-center">Recovery case not found.</div>;

  const variance = (recovery.actual_expense || 0) - (recovery.recovered_amount || 0);
  const recoveryRate = recovery.actual_expense > 0 ? Math.round(((recovery.recovered_amount || 0) / recovery.actual_expense) * 100) : 0;
  const isLeaking = recoveryRate < 70;

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 4rem)' }}>
      
      {/* Left: Case Detail */}
      <div className="flex-1 p-8 overflow-y-auto space-y-8">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-500 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${isLeaking ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {isLeaking ? 'Leaking' : 'Healthy'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 capitalize">{recovery.status?.replace(/_/g, ' ')}</span>
          </div>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
            {property?.property_name || 'Unknown'} — {recovery.recovery_category?.replace(/_/g, ' ') || 'Recovery'}
          </h1>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Budgeted', value: `R${(recovery.budgeted_amount || 0).toLocaleString()}`, icon: DollarSign },
            { label: 'Actual Expense', value: `R${(recovery.actual_expense || 0).toLocaleString()}`, icon: TrendingUp },
            { label: 'Recovered', value: `R${(recovery.recovered_amount || 0).toLocaleString()}`, icon: TrendingDown },
            { label: 'Recovery Rate', value: `${recoveryRate}%`, icon: Activity, color: recoveryRate >= 90 ? 'text-emerald-400' : recoveryRate >= 70 ? 'text-amber-400' : 'text-red-400' },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`w-4 h-4 ${(m as any).color || 'text-zinc-400'}`} />
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{m.label}</p>
              </div>
              <p className={`text-xl font-light ${(m as any).color || 'text-white'}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Variance detail */}
        {variance !== 0 && (
          <div className={`rounded-xl border p-5 ${isLeaking ? 'border-red-500/10 bg-red-500/[0.02]' : 'border-amber-500/10 bg-amber-500/[0.02]'}`}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className={`w-4 h-4 ${isLeaking ? 'text-red-400' : 'text-amber-400'}`} />
              <p className="text-sm text-white font-light">
                {isLeaking ? `R${variance.toLocaleString()} unrecovered` : `Variance: R${Math.abs(variance).toLocaleString()}`}
              </p>
            </div>
            <p className="text-xs text-zinc-400 font-light">
              {isLeaking 
                ? 'This recovery is significantly below the actual expense. Review meter allocations, tenant shares, and supplier invoices.'
                : 'Recovery variance is within acceptable range.'}
            </p>
          </div>
        )}

        {/* Cross-links */}
      <div className="flex gap-2 flex-wrap">
        <a href={`/properties`} className="flex items-center gap-1.5 rounded-full border border-white/[0.06] px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:border-white/15 transition-all">
          <Building2 className="w-3 h-3" /> Property
        </a>
        <a href={`/financials/revenue`} className="flex items-center gap-1.5 rounded-full border border-white/[0.06] px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:border-white/15 transition-all">
          <DollarSign className="w-3 h-3" /> Revenue
        </a>
        <a href={`/maintenance`} className="flex items-center gap-1.5 rounded-full border border-white/[0.06] px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:border-white/15 transition-all">
          <Activity className="w-3 h-3" /> Maintenance
        </a>
        <a href={`/inspections`} className="flex items-center gap-1.5 rounded-full border border-white/[0.06] px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:border-white/15 transition-all">
          <CheckCircle className="w-3 h-3" /> Inspections
        </a>
      </div>

      {/* Actions */}
        <div className="flex gap-2">
          {recovery.status === 'budgeted' && (
            <button className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Calculate Recovery</button>
          )}
          {recovery.status === 'expense_recorded' && (
            <button className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Calculate Recovery</button>
          )}
          {recovery.status === 'calculated' && (
            <>
              <button className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Approve</button>
              <button className="rounded-full border border-white/[0.08] px-4 py-2 text-xs text-white hover:border-white/20">Recalculate</button>
            </>
          )}
          {(recovery.status === 'billed' || recovery.status === 'recovered') && (
            <button className="rounded-full border border-white/[0.08] px-4 py-2 text-xs text-white hover:border-white/20">
              {recovery.status === 'billed' ? 'View Invoice' : 'View Payment'}
            </button>
          )}
        </div>
      </div>

      {/* Right: Timeline */}
      <div className="w-64 border-l border-white/[0.04] p-4 flex-shrink-0 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-4">Timeline</p>
        <div className="relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-white/[0.04]" />
          <div className="space-y-4">
            <div className="relative pl-5">
              <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-black bg-zinc-500" />
              <p className="text-[10px] text-zinc-600">{recovery.created_at ? new Date(recovery.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
              <p className="text-xs text-white font-light mt-0.5">Budget Set</p>
              <p className="text-[10px] text-zinc-600">R{(recovery.budgeted_amount || 0).toLocaleString()}</p>
            </div>
            {recovery.status !== 'budgeted' && (
              <div className="relative pl-5">
                <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-black bg-blue-400" />
                <p className="text-[10px] text-zinc-600">{recovery.updated_at ? new Date(recovery.updated_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                <p className="text-xs text-white font-light mt-0.5">Expense Recorded</p>
                <p className="text-[10px] text-zinc-600">R{(recovery.actual_expense || 0).toLocaleString()}</p>
              </div>
            )}
            {recovery.recovered_amount > 0 && (
              <div className="relative pl-5">
                <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-black bg-emerald-400" />
                <p className="text-[10px] text-zinc-600">{recovery.updated_at ? new Date(recovery.updated_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                <p className="text-xs text-white font-light mt-0.5">Recovered</p>
                <p className="text-[10px] text-zinc-600">R{(recovery.recovered_amount || 0).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Explanation */}
        <div className="mt-8 pt-6 border-t border-white/[0.04] space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Why {recoveryRate}%?</p>
          <div className="space-y-2 text-[11px] font-light">
            {recoveryRate < 90 && (
              <>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                  <span className="text-zinc-400">Recovery is below target because:</span>
                </div>
                <p className="text-zinc-500 ml-5">• Actual expense (R{(recovery.actual_expense || 0).toLocaleString()}) exceeds budgeted (R{(recovery.budgeted_amount || 0).toLocaleString()})</p>
                <p className="text-zinc-500 ml-5">• Tenant allocation may not reflect full consumption</p>
                <p className="text-zinc-500 ml-5">• Municipal tariff or meter reading may have changed</p>
                <p className="text-zinc-500 ml-5">• Estimated leakage: R{variance.toLocaleString()}</p>
                <p className="text-zinc-500 ml-5">• Confidence: {Math.min(95, 60 + ((100 - recoveryRate) * 0.5))}%</p>
              </>
            )}
            {recoveryRate >= 90 && (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-zinc-400">Recovery is healthy. Variance is within acceptable range.</span>
                </div>
              </>
            )}
          </div>
          {isLeaking && (
            <p className="text-[11px] text-zinc-400 font-light leading-relaxed mt-2">
              Recommended: Review meter allocation and tenant share percentages before billing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
