'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown, ChevronRight, Building2 } from "lucide-react";

type PropertyItem = {
  id: string;
  property_code: string | null;
  property_name: string;
  city: string;
  province: string;
  property_type: string;
  entity_id: string;
  entity_name: string;
  portfolio: string | null;
  gla: number;
  units: number;
  occupied: number;
  vacant: number;
  occupancy: number;
  revenue: number;
  arrears: number;
  expiring: number;
  property_status: string | null;
};

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewBy, setViewBy] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({ total: 0, occupied: 0, vacant: 0, revenue: 0 });
  const [lastUpdated, setLastUpdated] = useState("");
  const [recentProperties, setRecentProperties] = useState<PropertyItem[]>([]);

  useEffect(() => { loadData(); }, [searchTerm, viewBy]);

  useEffect(() => {
    const saved = localStorage.getItem('property-recents');
    if (saved) {
      const ids: string[] = JSON.parse(saved);
      const recents = ids.map(id => properties.find(p => p.id === id)).filter(Boolean) as PropertyItem[];
      setRecentProperties(recents.slice(0, 4));
    }
  }, [properties]);

  async function loadData() {
    setLoading(true);
    const res = await fetch(`/api/intelligence/properties?page=0&pageSize=500&search=${encodeURIComponent(searchTerm)}`);
    const json = await res.json();
    setProperties(json.properties || []);
    setTotalCount(json.total || 0);
    setSummary(json.summary || { total: 0, occupied: 0, vacant: 0, revenue: 0 });
    setLastUpdated(new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }));
    setLoading(false);
  }

  const openProperty = (id: string) => {
    const saved = localStorage.getItem('property-recents');
    const ids: string[] = saved ? JSON.parse(saved) : [];
    const updated = [id, ...ids.filter(i => i !== id)].slice(0, 10);
    localStorage.setItem('property-recents', JSON.stringify(updated));
    router.push(`/properties/${id}`);
  };

  const formatRands = (amount: number) => `R${(amount / 1000000).toFixed(1)}m`;
  const formatFullRands = (amount: number) => `R${amount.toLocaleString("en-ZA")}`;
  const occupancyPct = summary.total > 0 ? Math.round((summary.occupied / (summary.total * (properties.reduce((s, p) => s + p.units, 0) / summary.total || 1))) * 100) || 0 : 0;
  const totalGLA = properties.reduce((s, p) => s + (p.gla || 0), 0);

  const views = [
  { key: "all", label: "All" },
  { key: "entity", label: "Entity" },
  { key: "portfolio", label: "Portfolio" },
  { key: "region", label: "Region" },
  { key: "retail", label: "Retail" },
  { key: "office", label: "Office" },
  { key: "residential", label: "Residential" },
  { key: "Vacant", label: "Vacant" },
  { key: "sold", label: "Sold" },
];
const hasSearch = searchTerm.length > 0;

const grouped = new Map<string, Map<string, PropertyItem[]>>();
if (!hasSearch) {
  properties.forEach(p => {
    let groupKey: string;
    let subKey: string;

    if (viewBy === "entity") {
      groupKey = p.entity_name || "Unknown";
      subKey = p.portfolio || "No Portfolio";
    } else if (viewBy === "portfolio") {
      groupKey = p.portfolio || "No Portfolio";
      subKey = p.entity_name || "Unknown";
    } else if (viewBy === "region") {
      groupKey = p.province || "No Region";
      subKey = p.entity_name || "Unknown";
    } else if (["retail", "office", "residential"].includes(viewBy)) {
      if (p.property_type?.toLowerCase() !== viewBy) return;
      groupKey = p.entity_name || "Unknown";
      subKey = "All";
    } else if (viewBy === "Vacant") {
      if (p.occupied > 0) return;
      groupKey = p.entity_name || "Unknown";
      subKey = "All";
    } else if (viewBy === "sold") {
      if (p.property_status !== 'Disposed' && p.property_status !== 'Sold') return;
      groupKey = p.entity_name || "Unknown";
      subKey = "All";
    } else {
      groupKey = p.entity_name || "Unknown";
      subKey = p.portfolio || "No Portfolio";
    }

    if (!grouped.has(groupKey)) grouped.set(groupKey, new Map());
    if (!grouped.get(groupKey)!.has(subKey)) grouped.get(groupKey)!.set(subKey, []);
    grouped.get(groupKey)!.get(subKey)!.push(p);
  });
}

  const PropertyCard = ({ p }: { p: PropertyItem }) => (
    <button
      onClick={() => openProperty(p.id)}
      className="text-left rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4 hover:border-[var(--border-hover)] transition-colors w-full"
    >
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
        <p className="text-xs font-mono text-[var(--text-muted)]">{p.property_code || p.id.slice(0, 8)}</p>
      </div>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{p.property_name}</p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">{p.property_type} · {p.city}</p>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div>
          <p className="text-[var(--text-muted)]">Occupancy</p>
          <p className="text-[var(--text-primary)] font-medium">{p.occupied}/{p.units || "—"} · {p.occupancy}%</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">GLA</p>
          <p className="text-[var(--text-primary)] font-medium">{p.gla ? `${p.gla.toLocaleString()}m²` : "—"}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Revenue</p>
          <p className="text-[var(--text-primary)] font-medium">{formatRands(p.revenue)}/mo</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Arrears</p>
          <p className={`font-medium ${p.arrears > 0 ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>
            {p.arrears > 0 ? `R${Math.round(p.arrears/1000)}k` : "—"}
          </p>
        </div>
      </div>
      {p.expiring > 0 && (
        <p className="text-[10px] text-red-400 mt-2">{p.expiring} lease{p.expiring !== 1 ? 's' : ''} expiring</p>
      )}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      {/* Header — items 1, 6 from review */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Properties</h1>
        <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-muted)]">
          <span>{totalCount} assets</span>
          <span>·</span>
          <span className="text-emerald-400">{occupancyPct}% occupied</span>
          <span>·</span>
          <span>{totalGLA ? `${totalGLA.toLocaleString()}m² GLA` : ""}</span>
          <span>·</span>
          <span>{formatFullRands(summary.revenue)}/mo</span>
          <span>·</span>
          <span>Updated {lastUpdated}</span>
        </div>
      </div>

      {/* Search — item 1 */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search properties, codes, addresses, regions or portfolios..."
          className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-12 pr-4 py-3.5 text-sm outline-none focus:border-[var(--border-hover)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
      </div>

      {/* Recent — item 5 */}
      {!hasSearch && recentProperties.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--text-muted)]">Recent:</span>
          {recentProperties.map(p => (
            <button key={p.id} onClick={() => openProperty(p.id)}
              className="text-xs px-3 py-1 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors">
              {p.property_name}
            </button>
          ))}
        </div>
      )}

      {/* View By — items 2, 3, 4 */}
      <div className="flex gap-2 flex-wrap">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => setViewBy(v.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              viewBy === v.key ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 animate-pulse">
              <div className="h-4 bg-[var(--bg-elevated)] rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-[var(--bg-elevated)] rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">No properties found</div>
      ) : hasSearch ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(p => <PropertyCard key={p.id} p={p} />)}
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([group, subgroups]) => {
            const groupProperties = Array.from(subgroups.values()).flat();
            const groupRevenue = groupProperties.reduce((s, p) => s + p.revenue, 0);
            const groupOccupied = groupProperties.reduce((s, p) => s + p.occupied, 0);
            const groupUnits = groupProperties.reduce((s, p) => s + p.units, 0);
            const groupGLA = groupProperties.reduce((s, p) => s + (p.gla || 0), 0);

            return (
              <div key={group} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
                <button
                  onClick={() => setExpandedGroups(prev => { const next = new Set(prev); next.has(group) ? next.delete(group) : next.add(group); return next; })}
                  className="w-full flex items-center gap-2 px-5 py-3 hover:bg-[var(--bg-elevated)] transition-colors text-left"
                >
                  {expandedGroups.has(group) ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />}
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{group}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {groupProperties.length} properties · {groupOccupied}/{groupUnits || "—"} occupied · {groupGLA > 0 ? `${groupGLA.toLocaleString()}m²` : ""} · {formatRands(groupRevenue)}/mo
                  </span>
                </button>
                {expandedGroups.has(group) && (
                  <div className="border-t border-[var(--border-default)]">
                    {Array.from(subgroups.entries()).map(([sub, subProperties]) => (
                      <div key={sub}>
                        <button
                          onClick={() => setExpandedSubgroups(prev => { const next = new Set(prev); next.has(`${group}-${sub}`) ? next.delete(`${group}-${sub}`) : next.add(`${group}-${sub}`); return next; })}
                          className="w-full flex items-center gap-2 px-8 py-2 hover:bg-[var(--bg-elevated)] transition-colors text-left"
                        >
                          {expandedSubgroups.has(`${group}-${sub}`) ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />}
                          <span className="text-xs text-[var(--text-secondary)]">{sub}</span>
                          <span className="text-xs text-[var(--text-muted)]">{subProperties.length} properties</span>
                        </button>
                        {expandedSubgroups.has(`${group}-${sub}`) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-8 py-3">
                            {subProperties.map(p => <PropertyCard key={p.id} p={p} />)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
