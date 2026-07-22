'use client';
import { useState } from 'react';
export default function NotificationsPage() {
  const [form, setForm] = useState({
    email_enabled: true, whatsapp_enabled: true, in_app_enabled: true,
    reminder_days: 3, overdue_reminder: true, statement_ready: true,
    payment_received: true, lease_expiring: true,
    quiet_hours_enabled: false, quiet_start: '22:00', quiet_end: '07:00',
    digest: 'immediate',
  });
  return (
    <div className="space-y-8 max-w-2xl">
      <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Notifications</h1><p className="text-sm text-zinc-500 mt-1">Configure default notification preferences.</p></div>
      <div className="space-y-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Channels</p>
          {['email_enabled', 'whatsapp_enabled', 'in_app_enabled'].map(key => (
            <label key={key} className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer"><input type="checkbox" checked={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="rounded" />{key === 'email_enabled' ? 'Email' : key === 'whatsapp_enabled' ? 'WhatsApp' : 'In-App'}</label>
          ))}
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Events</p>
          {[{ key: 'statement_ready', label: 'Statement Ready' },{ key: 'payment_received', label: 'Payment Received' },{ key: 'lease_expiring', label: 'Lease Expiring' },{ key: 'overdue_reminder', label: 'Overdue Reminder' }].map(item => (
            <label key={item.key} className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer"><input type="checkbox" checked={(form as any)[item.key]} onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })} className="rounded" />{item.label}</label>
          ))}
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Quiet Hours</p>
          <label className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer"><input type="checkbox" checked={form.quiet_hours_enabled} onChange={(e) => setForm({ ...form, quiet_hours_enabled: e.target.checked })} className="rounded" />Enable quiet hours</label>
          {form.quiet_hours_enabled && (
            <div className="flex gap-4 items-center"><input type="time" value={form.quiet_start} onChange={(e) => setForm({ ...form, quiet_start: e.target.value })} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" /><span className="text-zinc-500 text-xs">to</span><input type="time" value={form.quiet_end} onChange={(e) => setForm({ ...form, quiet_end: e.target.value })} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" /></div>
          )}
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Digest Frequency</label>
          <select value={form.digest} onChange={(e) => setForm({ ...form, digest: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="immediate">Immediate</option><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Reminder Days Before Due</label>
          <input type="number" value={form.reminder_days} onChange={(e) => setForm({ ...form, reminder_days: parseInt(e.target.value) })} className="w-24 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        </div>
        <button className="rounded-lg bg-white px-6 py-2.5 text-xs font-medium text-black hover:bg-gray-100">Save</button>
      </div>
    </div>
  );
}
