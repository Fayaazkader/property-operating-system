'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { PageHeader } from "@/app/components/layout/PageHeader";


export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    async function loadData() {
      try {
        // 1. Get the current user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

               // 2. Get the user's entities via auth_entities()
        const { data: entityIds } = await supabase.rpc('auth_entities');
        if (!entityIds || entityIds.length === 0) { setLoading(false); return; }

        // 3. Get tenants filtered by entity
        const { data: tenantsData } = await supabase
          .from("tenants")
          .select("*")
          .in('entity_id', entityIds)
          .order("tenant_name");

        setTenants(tenantsData || []);

        // 4. Get entities
        const { data: entitiesData } = await supabase
          .from("entities")
          .select("id, entity_name")
          .in("id", entityIds)
          .order("entity_name");

        setEntities(entitiesData || []);
      } catch (error) {
        console.error('Error loading tenants:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function getEntityName(entityId: string | null): string {
    if (!entityId || !entities) return "—";
    return entities.find(e => e.id === entityId)?.entity_name || "—";
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
        <PageHeader title="Tenants" subtitle="Manage your tenants" />
        <p className="text-[var(--text-muted)]">Loading tenants...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader title="Tenants" subtitle="Manage your tenants" />

      {!tenants || tenants.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <p className="text-[var(--text-muted)]">No tenants found.</p>
          <Link href="/tenants/new" className="mt-4 inline-block rounded-xl bg-[var(--text-primary)] text-black px-5 py-3 text-sm font-semibold">+ Add Tenant</Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <table className="w-full">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Tenant</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Code</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Entity</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Email</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Phone</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t: any) => (
                <tr key={t.id} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)] font-medium">{t.tenant_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)] font-mono">{t.code || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{getEntityName(t.entity_id)}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{t.email || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{t.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}