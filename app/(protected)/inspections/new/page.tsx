'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { inspectionsEngine } from '@/lib/inspections/engine';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewInspectionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('routine');
  const [scheduledDate, setScheduledDate] = useState('');
  const [inspector, setInspector] = useState('');
  const [inspectorCompany, setInspectorCompany] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      const { data } = await supabase.from('properties').select('id, property_name').eq('entity_id', entities[0]);
      setProperties(data || []);
      if (data?.length) setPropertyId(data[0].id);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !scheduledDate) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: entities } = await supabase.rpc('auth_entities');
      await inspectionsEngine.create({
        entity_id: entities[0], property_id: propertyId,
        title, type: type as any, scheduled_date: scheduledDate,
        inspector: inspector || undefined,
        inspector_company: inspectorCompany || undefined,
        created_by: session?.user?.id,
      });
      router.push('/inspections');
    } catch (err) { alert('Failed to schedule inspection'); }
    setSubmitting(false);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/inspections" className="text-zinc-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Inspections</p>
          <h1 className="text-xl font-light tracking-[-0.02em] text-white">Schedule Inspection</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            placeholder="e.g. Annual Fire Inspection"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-light" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-light">
              {['routine','compliance','insurance','handover','quarterly','annual'].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Property</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-light">
              {properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Scheduled Date</label>
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-light" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Inspector Name</label>
            <input type="text" value={inspector} onChange={(e) => setInspector(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-light" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Company</label>
            <input type="text" value={inspectorCompany} onChange={(e) => setInspectorCompany(e.target.value)}
              placeholder="e.g. FireSafe Ltd"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-light" />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={submitting}
            className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40">
            {submitting ? 'Scheduling...' : 'Schedule Inspection'}
          </button>
          <Link href="/inspections" className="rounded-xl border border-white/[0.08] px-6 py-3 text-sm text-white hover:border-white/20">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
