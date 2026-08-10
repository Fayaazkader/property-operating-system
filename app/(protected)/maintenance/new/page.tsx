'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { maintenanceEngine } from '@/lib/maintenance/engine';
import { ArrowLeft, Upload, Camera } from 'lucide-react';
import Link from 'next/link';

export default function NewIssuePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [priority, setPriority] = useState('routine');
  const [propertyId, setPropertyId] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
    if (!title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: entities } = await supabase.rpc('auth_entities');
      await maintenanceEngine.createIssue({
        entity_id: entities[0],
        property_id: propertyId,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        reported_via: 'manual',
        reported_by: session?.user?.email || 'Unknown',
      });
      router.push('/maintenance');
    } catch (err: any) {
      setError(err.message || 'Failed to create issue');
    }
    setSubmitting(false);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/maintenance" className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Maintenance</p>
          <h1 className="text-xl font-light tracking-[-0.02em] text-white">Report New Issue</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            placeholder="e.g. Water leak in basement"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all font-light" />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Property</label>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all font-light">
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.property_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all font-light">
              {['plumbing','electrical','hvac','structural','waterproofing','fire','lifts','generator','cleaning','pest_control','landscaping','security','other'].map(c => (
                <option key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all font-light">
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            rows={4}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-all font-light resize-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="button"
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-3 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all">
            <Camera className="w-4 h-4" /> Add Photo
          </button>
          <button type="button"
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-3 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all">
            <Upload className="w-4 h-4" /> Upload Files
          </button>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={submitting}
            className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
            {submitting ? 'Creating...' : 'Create Issue'}
          </button>
          <Link href="/maintenance"
            className="rounded-xl border border-white/[0.08] px-6 py-3 text-sm text-white hover:border-white/20 transition-all">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
