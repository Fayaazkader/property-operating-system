'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { Search, Plus, ChevronDown, ChevronRight, MessageSquare, Mail } from "lucide-react";

type TenantSummary = {
  tenants: EnrichedTenant[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    active: number;
    arrears: number;
    expiring: number;
    archived: number;
  };
};

type EnrichedTenant = {
  id: string;
  tenant_name: string;
  code: string | null;
  company_registration: string | null;
  email: string;
  entity_id: string;
  entity_name: string;
  property_id: string | null;
  property_name: string | null;
  current_lease: string | null;
  lease_status: string | null;
  monthly_rental: number | null;
  balance: number;
  days_to_expiry: number;
  whatsapp_enabled: boolean;
};

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<EnrichedTenant[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
  const [recentTenants, setRecentTenants] = useState<EnrichedTenant[]>([]);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({ active: 0, arrears: 0, expiring: 0, archived: 0 });

  useEffect(() => { loadData(); }, [currentPage, pageSize, searchTerm, activeFilter]);

  useEffect(() => {
    localStorage.setItem('tenant-expanded-entities', JSON.stringify([...expandedEntities]));
  }, [expandedEntities]);

  useEffect(() => {
    localStorage.setItem('tenant-expanded-properties', JSON.stringify([...expandedProperties]));
  }, [expandedProperties]);

  useEffect(() => {
    const saved = localStorage.getItem('tenant-recents');
    if (saved) {
      const ids: string[] = JSON.parse(saved);
      const recents = ids.map(id => tenants.find(t => t.id === id)).filter(Boolean) as EnrichedTenant[];
      setRecentTenants(recents.slice(0, 5));
    }
  }, [tenants]);

  async function loadData() {
    setLoading(true);
    const res = await fetch(`/api/intelligence/tenants?page=${currentPage}&pageSize=${pageSize}&search=${encodeURIComponent(searchTerm)}&filter=${activeFilter}`);
    const json: TenantSummary = await res.json();

    setTenants(json.tenants || []);
    setTotalCount(json.total || 0);
    setSummary(json.summary || { active: 0, arrears: 0, expiring: 0, archived: 0 });
    setLastUpdated(new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }));

    const saved = localStorage.getItem('tenant-expanded-entities');
    if (saved) setExpandedEntities(new Set(JSON.parse(saved)));
    const savedProps = localStorage.getItem('tenant-expanded-properties');
    if (savedProps) setExpandedProperties(new Set(JSON.parse(savedProps)));

    setLoading(false);
  }

  const openTenant = (id: string) => {
    const saved = localStorage.getItem('tenant-recents');
    const ids: string[] = saved ? JSON.parse(saved) : [];
    const updated = [id, ...ids.filter(i => i !== id)].slice(0, 10);
    localStorage.setItem('tenant-recents', JSON.stringify(updated));
    router.push(`/tenants/${id}`);
  };

  const toggleEntity = (name: string) => {
    setExpandedEntities(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleProperty = (name: string) => {
    setExpandedProperties(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const filters = [
    { key: "all", label: "All", count: totalCount },
    { key: "active", label: "Active", count: summary.active },
    { key: "expiring", label: "Expiring", count: summary.expiring },
    { key: "arrears", label: "Arrears", count: summary.arrears },
    { key: "archived", label: "Archived", count: summary.archived },
  ];

  const hasSearch = searchTerm.length > 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const grouped = new Map<string, Map<string, EnrichedTenant[]>>();
  if (!hasSearch) {
    tenants.forEach(t => {
      const entityKey = t.entity_name || "Unknown Entity";
      const propertyKey = t.property_name || "No Property";
      if (!grouped.has(entityKey)) grouped.set(entityKey, new Map());
      if (!grouped.get(entityKey)!.has(propertyKey)) grouped.get(entityKey)!.set(propertyKey, []);
      grouped.get(entityKey)!.get(propertyKey)!.push(t);
    });
  }

  const formatRands = (amount: number) => `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;

  const TenantRow = ({ t }: { t: EnrichedTenant }) => (
    <tr
      onClick={() => openTenant(t.id)}
      className="border-b border-[var(--border-default)] last:border-0 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
    >
      <td className="py-2.5 px-4">
        <p className="text-[var(--text-primary)] font-medium font-mono text-xs">{t.code || t.id.slice(0, 8)}</p>
        <p className="text-[var(--text-primary)] text-sm">{t.tenant_name}</p>
        {t.company_registration && <p className="text-xs text-[var(--text-muted)]">{t.company_registration}</p>}
      </td>
      <td className="py-2.5 px-4">
        {t.current_lease ? (
          <div>
            <p className="text-[var(--text-primary)] font-mono text-xs">{t.current_lease}</p>
            <p className="text-xs text-[var(--text-muted)]">{t.monthly_rental ? formatRands(t.monthly_rental) : ""}</p>
          </div>
        ) : <span className="text-[var(--text-muted)]">—</span>}
      </td>
      <td className="py-2.5 px-4 text-right tabular-nums">
        <span className={t.balance > 0 ? 'text-amber-400' : 'text-[var(--text-primary)]'}>{formatRands(t.balance)}</span>
      </td>
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            t.lease_status === 'Active' ? 'bg-emerald-500/10 text-emerald-300' :
            t.lease_status === 'Expired' ? 'bg-red-500/10 text-red-300' :
            'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
          }`}>{t.lease_status || "—"}</span>
          {t.whatsapp_enabled && <MessageSquare className="w-3 h-3 text-emerald-400" />}
{t.email && <Mail className="w-3 h-3 text-blue-400" />}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      {/* Header */}
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tenant Operations</h1>
    <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-muted)]">
      <span>{totalCount} tenant accounts</span>
      <span>·</span>
      <span>{new Set(tenants.map(t => t.entity_id)).size} entities</span>
      <span>·</span>
      <span>{new Set(tenants.filter(t => t.property_id).map(t => t.property_id)).size} properties</span>
      <span>·</span>
      <span>Updated {lastUpdated}</span>
    </div>
  </div>
  <button
    onClick={() => router.push('/tenants/new')}
    className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
  >
    <Plus className="w-4 h-4" /> New Tenant
  </button>
</div>

      {/* Recent — item 5 from review */}
      {!hasSearch && recentTenants.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--text-muted)]">Recently Opened:</span>
          {recentTenants.map(t => (
            <button key={t.id} onClick={() => openTenant(t.id)}
              className="text-xs px-3 py-1 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors">
              {t.tenant_name}
            </button>
          ))}
        </div>
      )}

      {/* Search — item 6 from review */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(0); }}
          placeholder="Find a tenant, tenancy code, registered company, trading name, property, lease, VAT or contact..."
          className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-12 pr-4 py-3.5 text-sm outline-none focus:border-[var(--border-hover)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
      </div>

      {/* Filters — item 3 from review */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => { setActiveFilter(f.key); setCurrentPage(0); }}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === f.key
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-60">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 animate-pulse">
              <div className="h-4 bg-[var(--bg-elevated)] rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-[var(--bg-elevated)] rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--text-muted)]">No tenants match your search.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Try another tenancy code, property, registered company, or contact.</p>
        </div>
      ) : hasSearch ? (
        <div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)]">
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Tenant</th>
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Property</th>
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Lease</th>
                  <th className="text-right py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Balance</th>
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id} onClick={() => openTenant(t.id)}
                    className="border-b border-[var(--border-default)] last:border-0 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors">
                    <td className="py-2.5 px-4">
                      <p className="text-[var(--text-primary)] font-medium font-mono text-xs">{t.code || t.id.slice(0, 8)}</p>
                      <p className="text-[var(--text-primary)] text-sm">{t.tenant_name}</p>
                      {t.company_registration && <p className="text-xs text-[var(--text-muted)]">{t.company_registration}</p>}
                    </td>
                    <td className="py-2.5 px-4 text-[var(--text-secondary)]">{t.property_name || "—"}</td>
                    <td className="py-2.5 px-4">{t.current_lease ? <p className="text-[var(--text-primary)] font-mono text-xs">{t.current_lease}</p> : <span className="text-[var(--text-muted)]">—</span>}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums"><span className={t.balance > 0 ? 'text-amber-400' : 'text-[var(--text-primary)]'}>{formatRands(t.balance)}</span></td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.lease_status === 'Active' ? 'bg-emerald-500/10 text-emerald-300' : t.lease_status === 'Expired' ? 'bg-red-500/10 text-red-300' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>{t.lease_status || "—"}</span>
                        {t.whatsapp_enabled && <MessageSquare className="w-3 h-3 text-emerald-400" />}
                        {t.email && <Mail className="w-3 h-3 text-blue-400" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 mt-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>Rows</span>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-xs outline-none">
                  <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
                  className="px-2 py-1 rounded-lg hover:bg-[var(--bg-elevated)] disabled:opacity-30">←</button>
                <span className="text-[var(--text-muted)]">{currentPage + 1} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}
                  className="px-2 py-1 rounded-lg hover:bg-[var(--bg-elevated)] disabled:opacity-30">→</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([entity, properties]) => {
            const entityTenants = Array.from(properties.values()).flat();
            const entityRevenue = entityTenants.reduce((s, t) => s + (t.monthly_rental || 0), 0);
            return (
              <div key={entity} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
                <button onClick={() => toggleEntity(entity)}
                  className="w-full flex items-center gap-2 px-5 py-3 hover:bg-[var(--bg-elevated)] transition-colors text-left">
                  {expandedEntities.has(entity) ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />}
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{entity}</span>
                  <span className="text-xs text-[var(--text-muted)]">{entityTenants.length} active · {formatRands(entityRevenue)} monthly · {properties.size} properties</span>
                </button>
                {expandedEntities.has(entity) && (
                  <div className="border-t border-[var(--border-default)]">
                    {Array.from(properties.entries()).map(([property, propertyTenants]) => (
                      <div key={property}>
                        <button onClick={() => toggleProperty(`${entity}-${property}`)}
                          className="w-full flex items-center gap-2 px-8 py-2 hover:bg-[var(--bg-elevated)] transition-colors text-left">
                          {expandedProperties.has(`${entity}-${property}`) ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />}
                          <span className="text-xs text-[var(--text-secondary)]">{property}</span>
                          <span className="text-xs text-[var(--text-muted)]">{propertyTenants.length} active</span>
                          {propertyTenants.filter(t => t.balance > 0).length > 0 && (
                            <span className="text-xs text-amber-400">{propertyTenants.filter(t => t.balance > 0).length} arrears</span>
                          )}
                          {propertyTenants.filter(t => t.days_to_expiry <= 90 && t.lease_status === 'Active').length > 0 && (
                            <span className="text-xs text-red-400">{propertyTenants.filter(t => t.days_to_expiry <= 90 && t.lease_status === 'Active').length} expiring</span>
                          )}
                        </button>
                        {expandedProperties.has(`${entity}-${property}`) && (
                          <table className="w-full text-sm">
                            <tbody>
                              {propertyTenants.map(t => <TenantRow key={t.id} t={t} />)}
                            </tbody>
                          </table>
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
