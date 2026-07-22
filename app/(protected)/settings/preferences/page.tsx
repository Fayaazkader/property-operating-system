'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PreferencesPage() {
  const [form, setForm] = useState({
    theme: 'dark', layout: 'comfortable', dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h', timezone: 'Africa/Johannesburg', landingPage: 'morning-brief',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: prefs } = await supabase.from('user_preferences').select('*').eq('user_id', session.user.id).single();
      if (prefs) setForm({
        theme: prefs.theme || 'dark', layout: prefs.layout || 'comfortable',
        dateFormat: prefs.date_format || 'DD/MM/YYYY', timeFormat: prefs.time_format || '24h',
        timezone: prefs.timezone || 'Africa/Johannesburg', landingPage: prefs.landing_page || 'morning-brief',
      });
    }
    load();
  }, []);

  async function handleSave() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('user_preferences').upsert({
      user_id: session.user.id, theme: form.theme, layout: form.layout,
      date_format: form.dateFormat, time_format: form.timeFormat,
      timezone: form.timezone, landing_page: form.landingPage,
    }, { onConflict: 'user_id' });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Preferences</h1><p className="text-sm text-zinc-500 mt-1">Your personal display and interface preferences.</p></div>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Theme</label><select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="dark">Dark</option><option value="light">Light</option></select></div>
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Layout</label><select value={form.layout} onChange={(e) => setForm({ ...form, layout: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Date Format</label><select value={form.dateFormat} onChange={(e) => setForm({ ...form, dateFormat: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></div>
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Time Format</label><select value={form.timeFormat} onChange={(e) => setForm({ ...form, timeFormat: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="24h">24 Hour</option><option value="12h">12 Hour</option></select></div>
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Time Zone</label><select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="Africa/Johannesburg">Johannesburg (SAST)</option><option value="UTC">UTC</option></select></div>
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Default Landing Page</label><select value={form.landingPage} onChange={(e) => setForm({ ...form, landingPage: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="morning-brief">Morning Brief</option><option value="revenue">Revenue Operations</option><option value="financials">Financial Workspace</option></select></div>
        </div>
        <button onClick={handleSave} className="rounded-lg bg-white px-6 py-2.5 text-xs font-medium text-black hover:bg-gray-100 transition-all">{saved ? '✓ Saved' : 'Save Preferences'}</button>
      </div>
    </div>
  );
}
