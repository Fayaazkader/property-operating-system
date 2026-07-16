'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { calculatePulse } from "@/lib/intelligence/pulse";
import { useCommandPalette } from "@/lib/platform/CommandPaletteContext";

export default function HomePage() {
  const router = useRouter();
  const { open } = useCommandPalette();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [data, setData] = useState<any>({
    leases: [], transactions: [], recentLeases: [], communications: [],
    unallocated: [], vacantUnits: [], stmtPeriod: null, finPeriod: null,
    totalUnits: 0, occupiedUnits: 0, commsDelivered: 0, commsSent: 0, commsRead: 0,
  });

  useEffect(() => {
    async function checkAuthAndLoad() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/landing'); return; }
      const { data: profile } = await supabase.from("profiles").select("display_name, first_login").eq("id", session.user.id).single();
      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.first_login) setIsFirstLogin(true);

      const { data: entityIds } = await supabase.rpc('auth_entities');
      const entityIdList = entityIds || [];

      const { data: bankAccounts } = entityIdList.length > 0 
        ? await supabase.from("bank_accounts").select("id").in("entity_id", entityIdList) : { data: [] };
      const bankAccountIds = bankAccounts?.map(a => a.id) || [];

      const { data: entityTenants } = entityIdList.length > 0
        ? await supabase.from("tenants").select("id").in("entity_id", entityIdList) : { data: [] };
      const tenantIds = entityTenants?.map(t => t.id) || [];

      const { data: unitsData } = await supabase.from("units").select("id, occupancy_status");
      const totalUnits = unitsData?.length || 0;
      const occupiedUnits = unitsData?.filter(u => u.occupancy_status === 'Occupied').length || 0;

      const { data: commsData } = tenantIds.length > 0
        ? await supabase.from("communications").select("status").in("tenant_id", tenantIds) : { data: [] };
      const commsSent = commsData?.length || 0;
      const commsDelivered = commsData?.filter(c => c.status === 'delivered' || c.status === 'read').length || 0;
      const commsRead = commsData?.filter(c => c.status === 'read').length || 0;

      const [leasesRes, transactionsRes, recentLeasesRes, communicationsRes, unallocatedRes, vacantUnitsRes, stmtPeriodRes, finPeriodRes] = await Promise.all([
        entityIdList.length > 0 ? supabase.from("leases").select("*").in("owner_entity_id", entityIdList) : { data: [] },
        bankAccountIds.length > 0 ? supabase.from("bank_transactions").select("*").in("bank_account_id", bankAccountIds).order("created_at", { ascending: false }).limit(10) : { data: [] },
        entityIdList.length > 0 ? supabase.from("leases").select("*").in("owner_entity_id", entityIdList).order("created_at", { ascending: false }).limit(5) : { data: [] },
        tenantIds.length > 0 ? supabase.from("communications").select("*").in("tenant_id", tenantIds).order("created_at", { ascending: false }).limit(5) : { data: [] },
        bankAccountIds.length > 0 ? supabase.from("bank_transactions").select("transaction_amount").neq("allocation_status", "posted").in("bank_account_id", bankAccountIds) : { data: [] },
        supabase.from("units").select("id").eq("occupancy_status", "Vacant"),
        entityIdList.length > 0 ? supabase.from("financial_periods").select("*").eq("entity_id", entityIdList[0]).eq("period_type", "statement").order("end_date", { ascending: false }).limit(1).single() : { data: null },
        entityIdList.length > 0 ? supabase.from("financial_periods").select("*").eq("entity_id", entityIdList[0]).eq("period_type", "financial").order("end_date", { ascending: false }).limit(1).single() : { data: null },
      ]);

      setData({
        leases: leasesRes.data || [],
        transactions: transactionsRes.data || [],
        recentLeases: recentLeasesRes.data || [],
        communications: communicationsRes.data || [],
        unallocated: unallocatedRes.data || [],
        vacantUnits: vacantUnitsRes.data || [],
        stmtPeriod: stmtPeriodRes.data,
        finPeriod: finPeriodRes.data,
        totalUnits,
        occupiedUnits,
        commsSent,
        commsDelivered,
        commsRead,
      });
      setLoading(false);
    }
    checkAuthAndLoad();
  }, []);

  if (loading) return null;

  const { leases, transactions, recentLeases, communications, unallocated, vacantUnits, stmtPeriod, finPeriod, totalUnits, occupiedUnits, commsSent, commsDelivered, commsRead } = data;
  const totalContractedRevenue = leases?.reduce((sum: number, l: any) => sum + (l.monthly_rental || 0), 0) || 0;
  const occupancyPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const arrearsTotal = 0;
  const vacancyCount = vacantUnits?.length || 0;
  const vacancyCost = vacancyCount * 15000;
  const unallocatedTotal = unallocated?.reduce((sum: number, t: any) => sum + (t.transaction_amount || 0), 0) || 0;
  const commsHealthPct = commsSent > 0 ? Math.round((commsDelivered / commsSent) * 100) : 100;

  const criticalLeases = leases?.filter((l: any) => {
    const end = new Date(l.lease_end_date || l.expiry_date);
    const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 90;
  }) || [];
  const expiringLeases = criticalLeases;
  const revenueAtRisk = criticalLeases.reduce((sum: number, l: any) => sum + ((l.monthly_rental || 0) * 12), 0);

  const pulse = calculatePulse({ leases, transactions, totalUnits, occupiedUnits, arrearsTotal, vacancyCount });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-8 pt-16 pb-24">
      
      {/* GREETING */}
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Morning Brief</p>
        <h1 className="text-4xl font-light tracking-[-0.02em] text-white">
          {greeting}{displayName ? `, ${displayName}` : ""}.
        </h1>
        <p className="text-lg text-zinc-400 font-light leading-relaxed max-w-xl">
          {criticalLeases.length === 0 && unallocatedTotal < 100000 
            ? "Your portfolio is healthy. A few items need attention." 
            : `${criticalLeases.length} lease${criticalLeases.length !== 1 ? 's' : ''} expiring. ${unallocatedTotal > 0 ? `${Math.round(unallocatedTotal / 1000)}k unallocated.` : ''}`}
        </p>
      </div>

      {/* PERIOD INDICATORS */}
      <div className="flex gap-4">
        {stmtPeriod && (
          <div className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5">
            <span className="text-[11px] text-zinc-500">Statement: </span>
            <span className="text-[11px] text-zinc-300 font-light">{stmtPeriod.period_name} · {stmtPeriod.status === "open" ? "Open" : "Closed"}</span>
          </div>
        )}
        {finPeriod && (
          <div className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5">
            <span className="text-[11px] text-zinc-500">Financial: </span>
            <span className="text-[11px] text-zinc-300 font-light">{finPeriod.period_name} · {finPeriod.status === "open" ? "Open" : "Closed"}</span>
          </div>
        )}
      </div>

      {/* KPI ROW */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Monthly Revenue", value: `R${(totalContractedRevenue / 1000).toFixed(0)}k`, sub: `${leases?.length || 0} active leases` },
          { label: "Occupancy", value: `${occupancyPct}%`, sub: `${occupiedUnits}/${totalUnits} units` },
          { label: "Arrears", value: `R${(arrearsTotal / 1000).toFixed(0)}k`, sub: "0 overdue" },
          { label: "Vacancy Cost", value: `R${(vacancyCost / 1000).toFixed(0)}k`, sub: `${vacancyCount} vacant units` },
          { label: "Comms Health", value: `${commsHealthPct}%`, sub: `${commsDelivered} delivered` },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">{kpi.label}</p>
            <p className="text-2xl font-light tracking-[-0.02em] text-white">{kpi.value}</p>
            <p className="text-[11px] text-zinc-600 mt-1 font-light">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ATTENTION + PULSE */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-4">Needs Attention</p>
          {criticalLeases.length === 0 && unallocatedTotal < 100000 ? (
            <p className="text-sm text-zinc-400 font-light">Nothing critical. Portfolio is in good shape.</p>
          ) : (
            <div className="space-y-4">
              {criticalLeases.slice(0, 3).map((l: any, i: number) => (
                <Link key={i} href="/tenants" className="flex items-start gap-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] rounded-lg px-3 -mx-3 transition-colors">
                  <span className="text-amber-400 text-lg font-light mt-0.5">!</span>
                  <div>
                    <p className="text-sm text-white font-light">{l.tenant_name || "Unknown"} lease expires in {Math.ceil((new Date(l.lease_end_date || l.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days</p>
                    <p className="text-[11px] text-zinc-500 font-light mt-0.5">Annual value: R{((l.monthly_rental || 0) * 12).toLocaleString()}</p>
                  </div>
                </Link>
              ))}
              {unallocatedTotal > 0 && (
                <Link href="/financials/cash-book" className="flex items-start gap-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] rounded-lg px-3 -mx-3 transition-colors">
                  <span className="text-amber-400 text-lg font-light mt-0.5">!</span>
                  <div>
                    <p className="text-sm text-white font-light">Unallocated receipts: R{unallocatedTotal.toLocaleString()}</p>
                    <p className="text-[11px] text-zinc-500 font-light mt-0.5">Requires reconciliation</p>
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-4">Portfolio Pulse</p>
          <div className="space-y-4">
            {[
              { label: "Revenue", trend: pulse.revenue.trend, variance: pulse.revenue.variance },
              { label: "Occupancy", trend: pulse.occupancy.trend, variance: pulse.occupancy.variance },
              { label: "Arrears", trend: pulse.arrears.trend, variance: pulse.arrears.variance },
              { label: "Vacancy", trend: pulse.vacancy.trend, variance: pulse.vacancy.variance },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-[11px] text-zinc-500 font-light">{item.label}</span>
                <span className={`text-[11px] font-light ${item.trend === 'up' && item.label !== 'Arrears' && item.label !== 'Vacancy' ? 'text-emerald-400' : item.trend === 'down' && (item.label === 'Arrears' || item.label === 'Vacancy') ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {item.variance > 0 ? '+' : ''}{item.variance}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ACTIVITY */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-4">Recent Activity</p>
        <div className="space-y-1">
          {transactions?.slice(0, 5).map((tx: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full ${tx.transaction_amount >= 0 ? 'bg-emerald-400/60' : 'bg-zinc-600'}`} />
                <p className="text-sm text-zinc-300 font-light">{tx.transaction_description || "Transaction"}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-zinc-400 font-light tabular-nums">R{Math.abs(tx.transaction_amount || 0).toLocaleString()}</span>
                <span className="text-[11px] text-zinc-600 font-light">{tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : ""}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SEARCH */}
      <button onClick={open} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.01] px-5 py-4 text-sm text-zinc-500 text-left hover:border-white/10 transition-all font-light">
        Search tenants, leases, statements, receipts...
      </button>
    </div>
  );
}
