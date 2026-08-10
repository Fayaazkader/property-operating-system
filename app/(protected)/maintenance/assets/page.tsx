'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function AssetHealthPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }

      const { data } = await supabase
        .from('property_assets')
        .select('*')
        .eq('entity_id', entities[0])
        .order('name');

      setAssets(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const categories = [...new Set(assets.map(a => a.category))];

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/maintenance" className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Maintenance</p>
          <h1 className="text-xl font-light tracking-[-0.02em] text-white">Asset Health</h1>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-12 text-center">
          <Shield className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
          <p className="text-sm text-zinc-500 font-light">No assets registered yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Add assets to start tracking their health and maintenance history.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map(cat => {
            const catAssets = assets.filter(a => a.category === cat);
            const operational = catAssets.filter(a => a.status === 'operational').length;
            const pct = Math.round((operational / catAssets.length) * 100);
            return (
              <div key={cat} className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-white font-light capitalize">{cat.replace('_', ' ')}</p>
                  <span className={`text-xs ${pct >= 90 ? 'text-emerald-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                    {pct}% operational
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-emerald-400' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {catAssets.slice(0, 3).map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'operational' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="text-zinc-400 font-light truncate">{a.name}</span>
                    </div>
                  ))}
                  {catAssets.length > 3 && <span className="text-[10px] text-zinc-600">+{catAssets.length - 3} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
