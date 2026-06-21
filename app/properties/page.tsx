'use client';

import { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { PageHeader } from "../components/layout/PageHeader";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current user:', user?.id);

        if (!user) {
          console.log('No user found');
          setLoading(false);
          return;
        }

               // 2. Get the user's entities via auth_entities()
        const { data: entityIds } = await supabase.rpc('auth_entities');
        if (!entityIds || entityIds.length === 0) { setLoading(false); return; }

        // 3. Get properties filtered by entity
        const { data: propertiesData } = await supabase
          .from("properties")
          .select("*")
          .in('entity_id', entityIds)
          .order("property_name");

        setProperties(propertiesData || []);

        // 4. Get entities
        const { data: entitiesData } = await supabase
          .from("entities")
          .select("id, entity_name")
          .in("id", entityIds)
          .order("entity_name");

        setEntities(entitiesData || []);
      } catch (error) {
        console.error('Error loading data:', error);
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
        <PageHeader title="Properties" subtitle="Manage your property portfolio" />
        <p className="text-[var(--text-muted)]">Loading properties...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader title="Properties" subtitle="Manage your property portfolio" />

      {!properties || properties.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <p className="text-[var(--text-muted)]">No properties found.</p>
          <Link href="/properties/new" className="mt-4 inline-block rounded-xl bg-[var(--text-primary)] text-black px-5 py-3 text-sm font-semibold">+ Add Property</Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <table className="w-full">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Property</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Code</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Entity</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">City</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">GLA (sqm)</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p: any) => (
                <tr key={p.id} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)] font-medium">{p.property_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)] font-mono">{p.property_code || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{getEntityName(p.entity_id)}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{p.city || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)] text-right tabular-nums">{p.total_gla_sqm?.toLocaleString() || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.property_status === "Active" ? "bg-emerald-500/10 text-emerald-300" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                    }`}>{p.property_status || "Unknown"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}