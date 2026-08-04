'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const CUSTOMER_FLAGS = [
  { key: 'email_notifications', name: 'Email Notifications', description: 'Send notifications via Email', category: 'communications' },
  { key: 'whatsapp_notifications', name: 'WhatsApp Notifications', description: 'Send notifications via WhatsApp', category: 'communications' },
  { key: 'morning_brief', name: 'Morning Brief', description: 'Enable Morning Brief dashboard', category: 'operations' },
  { key: 'auto_allocation', name: 'Auto Allocation', description: 'Automatically allocate receipts to invoices', category: 'operations' },
  { key: 'disbursement', name: 'Disbursement Operations', description: 'Enable payment and disbursement features', category: 'operations' },
];

const SYSTEM_FLAGS = [
  { key: 'automation_engine', name: 'Automation Engine', description: 'Enable workflow automation engine', category: 'platform' },
  { key: 'conversation_platform', name: 'Conversation Platform', description: 'Enable AI conversation features', category: 'platform' },
  { key: 'document_intelligence', name: 'Document Intelligence', description: 'Enable OCR and document processing', category: 'platform' },
  { key: 'bank_integration', name: 'Bank Integration', description: 'Enable direct bank integration', category: 'platform' },
  { key: 'document_signing_pro', name: 'Document Signing Pro', description: 'Unlock premium document signing features', category: 'platform' },
];

export default function FeatureFlagsPage() {
  const [entityId, setEntityId] = useState('');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      const eid = entities?.[0] || ''; setEntityId(eid);
      
      const { data: profile } = await supabase.from('profiles').select('platform_role').eq('id', session.user.id).single();
      setIsPlatformAdmin(profile?.platform_role === 'platform_admin');

      if (eid) {
        const { data } = await supabase.from('feature_flags').select('flag_key, enabled').eq('entity_id', eid);
        const map: Record<string, boolean> = {};
        (data || []).forEach((f: any) => { map[f.flag_key] = f.enabled; });
        setFlags(map);
      }
    }
    load();
  }, []);

  async function toggleFlag(key: string, enabled: boolean) {
    setFlags({ ...flags, [key]: enabled });
    if (entityId) {
      await supabase.from('feature_flags').upsert({ entity_id: entityId, flag_key: key, enabled, flag_name: [...CUSTOMER_FLAGS, ...SYSTEM_FLAGS].find(f => f.key === key)?.name || key }, { onConflict: 'entity_id,flag_key' });
    }
    setSaved(true); setTimeout(() => setSaved(false), 1000);
  }

  function FlagRow({ flag }: { flag: { key: string; name: string; description: string } }) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
        <div>
          <p className="text-sm text-white font-light">{flag.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{flag.description}</p>
        </div>
        <button
          onClick={() => toggleFlag(flag.key, !flags[flag.key])}
          className={`relative w-10 h-5 rounded-full transition-colors ${flags[flag.key] ? 'bg-emerald-500' : 'bg-zinc-700'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${flags[flag.key] ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Feature Flags</h1>
        <p className="text-sm text-zinc-500 mt-1">Enable or disable platform features.</p>
      </div>

      {/* Customer Settings */}
      <div className="space-y-3">
        <p className="text-xs text-zinc-400 uppercase tracking-wider">Customer Settings</p>
        <p className="text-[11px] text-zinc-600 -mt-2 mb-2">These can be toggled by entity administrators.</p>
        {CUSTOMER_FLAGS.map(flag => (<FlagRow key={flag.key} flag={flag} />))}
      </div>

      {/* System Feature Flags */}
      {isPlatformAdmin && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">System Feature Flags</p>
          <p className="text-[11px] text-zinc-600 -mt-2 mb-2">Only visible to platform administrators.</p>
          {SYSTEM_FLAGS.map(flag => (<FlagRow key={flag.key} flag={flag} />))}
        </div>
      )}

      {saved && <p className="text-xs text-emerald-400">✓ Saved</p>}
    </div>
  );
}
