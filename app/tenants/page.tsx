"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { PageHeader } from "../components/layout/PageHeader";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("tenants").select("*").order("tenant_name");
      if (data) setTenants(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = tenants.filter(t => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (t.tenant_name || "").toLowerCase().includes(s) || (t.industry || "").toLowerCase().includes(s);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader title="Tenants" subtitle="Manage your tenant database" />

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search tenants..."
        className="w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] placeholder:text-[var(--text-muted)]"
      />

      {loading ? (
        <div className="text-center py-20"><p className="text-[var(--text-muted)]">Loading...</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <p className="text-[var(--text-muted)]">No tenants found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <table className="w-full">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Tenant</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Industry</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Registration</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">VAT</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)] font-medium">{t.tenant_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{t.industry || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)] font-mono text-xs">{t.company_registration || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)] font-mono text-xs">{t.vat_number || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{t.email || t.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}