'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { TrendingDown, Calendar, Building2, DollarSign, BarChart3, Download, Clock, Star, Filter } from "lucide-react";

const reportCategories = [
  {
    category: "Financial",
    icon: DollarSign,
    reports: [
      { name: "Rent Roll", description: "Active leases with rental, deposits, arrears, GLA, and rates", href: "/reports/rent-roll", formats: ["PDF", "Excel", "CSV"], schedule: "Monthly", lastGenerated: "Today 07:02", favorite: true },
      { name: "Arrears Report", description: "Aging analysis: current, 30, 60, 90, 120+ days", href: "/reports/arrears", formats: ["PDF", "Excel"], schedule: "Weekly", lastGenerated: "Yesterday 16:30", favorite: true },
      { name: "Income Statement", description: "Revenue by property, entity, and portfolio", href: "/reports/income-statement", formats: ["PDF", "Excel"], favorite: false },
      { name: "Recovery Analysis", description: "Utilities, rates, and operating costs recovered vs billed", href: "/reports/recovery", formats: ["Excel"], favorite: false },
      { name: "Deposit Ledger", description: "Deposits received, interest, refunds, and current balances", href: "/reports/deposits", formats: ["PDF", "Excel"], favorite: false },
    ],
  },
  {
    category: "Leasing",
    icon: Calendar,
    reports: [
      { name: "Lease Expiry Schedule", description: "Leases expiring by month, property, and entity", href: "/reports/lease-expiry", formats: ["PDF", "Excel"], schedule: "Monthly", lastGenerated: "Today 06:45", favorite: true },
      { name: "Renewal Pipeline", description: "Leases expiring within 90 and 180 days with revenue at risk", href: "/reports/renewals", formats: ["PDF", "Excel"], favorite: false },
      { name: "Escalation Schedule", description: "Upcoming escalations and projected revenue impact", href: "/reports/escalations", formats: ["Excel"], favorite: false },
      { name: "Lease Audit", description: "All changes to lease terms, dates, and amounts", href: "/reports/lease-audit", formats: ["PDF"], favorite: false },
    ],
  },
  {
    category: "Portfolio",
    icon: Building2,
    reports: [
      { name: "Occupancy Report", description: "Occupancy rates by property, type, entity, and region", href: "/reports/occupancy", formats: ["PDF", "Excel"], schedule: "Weekly", lastGenerated: "Yesterday 09:00", favorite: false },
      { name: "Vacancy Report", description: "Vacant units, lost revenue, and days vacant", href: "/reports/vacancy", formats: ["PDF", "Excel"], favorite: false },
      { name: "WALE Report", description: "Weighted Average Lease Expiry across portfolio", href: "/reports/wale", formats: ["PDF", "Excel"], favorite: false },
      { name: "Tenant Concentration", description: "Revenue concentration and risk exposure by tenant", href: "/reports/concentration", formats: ["PDF", "Excel"], favorite: false },
      { name: "NOI Report", description: "Net Operating Income per property with margins", href: "/reports/noi", formats: ["PDF", "Excel"], schedule: "Monthly", lastGenerated: "Last Week", favorite: false },
    ],
  },
  {
    category: "Operations",
    icon: BarChart3,
    reports: [
      { name: "Billing Summary", description: "Charges generated, billed, unbilled, and exceptions", href: "/reports/billing", formats: ["PDF", "Excel"], favorite: false },
      { name: "Communications Report", description: "Sent, delivered, read, and failed by channel", href: "/reports/communications-report", formats: ["PDF", "Excel"], favorite: false },
      { name: "Task Report", description: "Open, overdue, and completed by assignee", href: "/reports/tasks-report", formats: ["PDF", "Excel"], favorite: false },
    ],
  },
  {
    category: "Intelligence",
    icon: TrendingDown,
    reports: [
      { name: "Revenue at Risk", description: "Largest revenue exposures from expiries, vacancies, and arrears", href: "/reports/revenue-risk", formats: ["PDF"], favorite: false },
      { name: "Arrears Exposure", description: "Largest outstanding balances and aging trends", href: "/reports/arrears-exposure", formats: ["PDF", "Excel"], favorite: false },
      { name: "Leases Requiring Attention", description: "Expiring, under-renewal, holding over, and disputes", href: "/reports/leases-attention", formats: ["PDF"], favorite: false },
      { name: "Concentration Risk", description: "Top tenants, industries, and geographic exposure", href: "/reports/concentration-risk", formats: ["PDF", "Excel"], favorite: false },
    ],
  },
];

export default function ReportsPage() {
  const router = useRouter();
  const [viewBy, setViewBy] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [dateAsAt, setDateAsAt] = useState(new Date().toISOString().split("T")[0]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [entities, setEntities] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  useEffect(() => {
    async function load() {
      const { data: ent } = await supabase.from("entities").select("id, entity_name").order("entity_name");
      const { data: props } = await supabase.from("properties").select("id, property_name, province").order("property_name");
      if (ent) setEntities(ent);
      if (props) {
        setProperties(props);
        const uniqueRegions = [...new Set(props.map((p: any) => p.province).filter(Boolean))];
        setRegions(uniqueRegions.map((r: any) => ({ id: r, name: r })));
      }
    }
    load();
  }, []);

  const allReports = reportCategories.flatMap(cat => cat.reports.map(r => ({ ...r, category: cat.category })));
  const favorites = allReports.filter(r => r.favorite);
  const scheduled = allReports.filter(r => r.schedule);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Reporting Centre</h1>
        <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-muted)]">
          <span>{allReports.length} reports available</span><span>·</span>
          <span className="text-emerald-400">{scheduled.length} scheduled deliveries</span><span>·</span>
          <span>Last run: Today 07:00</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">18</p><p className="text-xs text-[var(--text-muted)]">Generated Today</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-emerald-400">{scheduled.length}</p><p className="text-xs text-[var(--text-muted)]">Scheduled</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">312</p><p className="text-xs text-[var(--text-muted)]">Generated This Month</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-amber-400">28</p><p className="text-xs text-[var(--text-muted)]">Delivered Today</p></div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-[var(--text-muted)]" />
        {(["all", "entity", "property", "region"] as const).map((v) => (
          <button key={v} onClick={() => setViewBy(v)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${viewBy === v ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'}`}>
            {v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
        {viewBy === "entity" && (
          <select value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none">
            <option value="">All Entities</option>
            {entities.map((e: any) => <option key={e.id} value={e.id}>{e.entity_name}</option>)}
          </select>
        )}
        {viewBy === "property" && (
          <select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none">
            <option value="">All Properties</option>
            {properties.map((p: any) => <option key={p.id} value={p.id}>{p.property_name}</option>)}
          </select>
        )}
        {viewBy === "region" && (
          <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none">
            <option value="">All Regions</option>
            {regions.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <span className="text-xs text-[var(--text-muted)] ml-2">As at:</span>
        <input type="date" value={dateAsAt} onChange={(e) => setDateAsAt(e.target.value)} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none" />
      </div>

      {favorites.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3"><Star className="w-4 h-4 text-amber-400" /><h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-[0.1em]">Frequently Used</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {favorites.map(report => (
              <button key={report.name} onClick={() => {
  const params = new URLSearchParams();
  if (viewBy === "entity" && selectedEntity) params.set("entity", selectedEntity);
  if (viewBy === "property" && selectedProperty) params.set("property", selectedProperty);
  if (viewBy === "region" && selectedRegion) params.set("region", selectedRegion);
  if (dateAsAt) params.set("as_at", dateAsAt);
  const queryString = params.toString();
  router.push(queryString ? `${report.href}?${queryString}` : report.href);
}} className="text-left rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 hover:border-[var(--border-hover)] transition-colors group">
                <div className="flex items-center justify-between mb-1"><p className="text-sm font-medium text-[var(--text-primary)]">{report.name}</p><Star className="w-3 h-3 text-amber-400" /></div>
                <p className="text-xs text-[var(--text-muted)]">{report.description}</p>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--text-muted)]">
                  {report.lastGenerated && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {report.lastGenerated}</span>}
                  {report.schedule && <span className="bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full">{report.schedule}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {scheduled.length > 0 && (
        <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300 mb-2">Scheduled Deliveries</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {scheduled.map(r => (
              <div key={r.name} className="flex items-center gap-2"><Clock className="w-3 h-3 text-emerald-400" /><span className="text-[var(--text-primary)]">{r.name}</span><span className="text-[var(--text-muted)]">→ {r.category} Team</span><span className="text-emerald-400">{r.schedule}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap border-b border-[var(--border-default)] pb-2">
        <button onClick={() => setActiveCategory("all")} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${activeCategory === "all" ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>All Reports</button>
        {reportCategories.map(cat => (
          <button key={cat.category} onClick={() => setActiveCategory(cat.category)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${activeCategory === cat.category ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{cat.category}</button>
        ))}
      </div>

      {reportCategories.filter(cat => activeCategory === "all" || cat.category === activeCategory).map(cat => (
        <div key={cat.category}>
          <button onClick={() => {
            setCollapsedCategories(prev => {
              const next = new Set(prev);
              next.has(cat.category) ? next.delete(cat.category) : next.add(cat.category);
              return next;
            });
          }} className="flex items-center gap-2 mb-3 w-full text-left hover:opacity-80 transition-opacity">
            <cat.icon className="w-4 h-4 text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-[0.1em]">{cat.category}</h2>
            <span className="text-xs text-[var(--text-muted)]">{cat.reports.length} reports</span>
            <span className="text-[var(--text-muted)] text-xs ml-auto">{collapsedCategories.has(cat.category) ? "▶" : "▼"}</span>
          </button>
          {!collapsedCategories.has(cat.category) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
             {cat.reports.map(report => (
                <button key={report.name} onClick={() => {
  const params = new URLSearchParams();
  if (viewBy === "entity" && selectedEntity) params.set("entity", selectedEntity);
  if (viewBy === "property" && selectedProperty) params.set("property", selectedProperty);
  if (viewBy === "region" && selectedRegion) params.set("region", selectedRegion);
  if (dateAsAt) params.set("as_at", dateAsAt);
  const queryString = params.toString();
  router.push(queryString ? `${report.href}?${queryString}` : report.href);
}} className="text-left rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 hover:border-[var(--border-hover)] transition-colors group">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium text-[var(--text-primary)]">{report.name}</p><div className="flex items-center gap-1">{report.favorite && <Star className="w-3 h-3 text-amber-400" />}<Download className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" /></div></div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{report.description}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {report.formats.map(f => (<span key={f} className="text-[10px] bg-[var(--bg-elevated)] text-[var(--text-muted)] px-2 py-0.5 rounded-full">{f}</span>))}
                    {report.schedule && (<span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full">{report.schedule}</span>)}
                    {report.lastGenerated && (<span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1"><Clock className="w-3 h-3" /> {report.lastGenerated}</span>)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
