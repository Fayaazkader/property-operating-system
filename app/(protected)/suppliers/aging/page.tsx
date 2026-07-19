'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';

export default function AgingPage() {
  const [aging, setAging] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const result = await apApi.getAging(entities[0]).catch(() => ({}));
      setAging(result);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Aging</h1>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
        <div className="grid grid-cols-5 gap-3 text-center">
          {[{ label: 'Current', value: aging?.current || 0 }, { label: '1-30 Days', value: aging?.days30 || 0 }, { label: '31-60', value: aging?.days60 || 0 }, { label: '61-90', value: aging?.days90 || 0 }, { label: '120+', value: aging?.days120 || 0 }].map(b => (
            <div key={b.label} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4">
              <p className="text-xs text-zinc-500 mb-2">{b.label}</p>
              <p className={`text-2xl font-light ${b.value > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>R{b.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
