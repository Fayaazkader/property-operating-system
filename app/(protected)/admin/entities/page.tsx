'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function EntitiesPage() {
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, any>>({});

  const [name, setName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [entityCode, setEntityCode] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [postalAddress, setPostalAddress] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('South Africa');
  const [financialYearStart, setFinancialYearStart] = useState('3');
  const [accountingMode, setAccountingMode] = useState('accrual');
  const [baseCurrency, setBaseCurrency] = useState('ZAR');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => { loadEntities(); }, []);

  async function loadEntities() {
    setLoading(true);
    const { data } = await supabase.from('entities').select('*').order('created_at', { ascending: false });
    setEntities(data || []);
    
    const statsMap: Record<string, any> = {};
    for (const e of (data || [])) {
      const [props, tenants, leases, users] = await Promise.all([
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
        supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
        supabase.from('leases').select('id', { count: 'exact', head: true }).or(`owner_entity_id.eq.${e.id},managing_entity_id.eq.${e.id}`),
        supabase.from('user_entity_access').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
      ]);
      statsMap[e.id] = { properties: props.count || 0, tenants: tenants.count || 0, leases: leases.count || 0, users: users.count || 0 };
    }
    setStats(statsMap);
    setLoading(false);
  }

  function openCreate() { resetForm(); setShowCreate(true); setEditingId(null); }

  function openEdit(entity: any) {
    setName(entity.name || entity.entity_name || '');
    setTradingName(entity.trading_name || '');
    setEntityCode(entity.entity_code || '');
    setRegNumber(entity.registration_number || '');
    setVatNumber(entity.vat_number || '');
    setPhysicalAddress(entity.physical_address || '');
    setPostalAddress(entity.postal_address || '');
    setTelephone(entity.telephone || '');
    setEmail(entity.email || '');
    setWebsite(entity.website || '');
    setCountry(entity.country || 'South Africa');
    setFinancialYearStart(String(entity.financial_year_start || 3));
    setAccountingMode(entity.accounting_mode || 'accrual');
    setBaseCurrency(entity.base_currency || 'ZAR');
    setIsActive(entity.is_active ?? true);
    setShowCreate(true);
    setEditingId(entity.id);
  }

  function resetForm() {
    setName(''); setTradingName(''); setEntityCode(''); setRegNumber(''); setVatNumber('');
    setPhysicalAddress(''); setPostalAddress(''); setTelephone(''); setEmail(''); setWebsite('');
    setCountry('South Africa'); setFinancialYearStart('3'); setAccountingMode('accrual');
    setBaseCurrency('ZAR'); setIsActive(true);
  }

  async function handleSave() {
    if (!name) return;
    const data = {
      name, trading_name: tradingName || null,
      entity_code: entityCode || 'ENT-' + Date.now().toString(36).toUpperCase(),
      registration_number: regNumber || null, vat_number: vatNumber || null,
      physical_address: physicalAddress || null, postal_address: postalAddress || null,
      telephone: telephone || null, email: email || null, website: website || null,
      country, financial_year_start: parseInt(financialYearStart) || 3,
      accounting_mode: accountingMode, base_currency: baseCurrency,
      is_active: isActive, updated_at: new Date().toISOString(),
    };

    if (editingId) {
      await supabase.from('entities').update(data).eq('id', editingId);
    } else {
      await supabase.from('entities').insert({ ...data, entity_name: name });
    }

    setShowCreate(false); resetForm(); loadEntities();
  }

  async function handleArchive(entityId: string) {
    const { count: activeLeases } = await supabase.from('leases').select('id', { count: 'exact', head: true }).or(`owner_entity_id.eq.${entityId},managing_entity_id.eq.${entityId}`).eq('lease_status', 'Active');
    if (activeLeases && activeLeases > 0) {
      alert(`Cannot archive: ${activeLeases} active lease(s) still exist. Resolve them first.`);
      return;
    }
    await supabase.from('entities').update({ is_archived: true, is_active: false, updated_at: new Date().toISOString() }).eq('id', entityId);
    loadEntities();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Administration</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Entities</h1>
        </div>
        <button onClick={openCreate} className="rounded-full bg-white px-5 py-2.5 text-xs font-medium text-black hover:bg-gray-100 transition-all">Create Entity</button>
      </div>

      {loading ? <p className="text-sm text-zinc-500">Loading...</p> : (
        <div className="space-y-3">
          {entities.map(entity => (
            <div key={entity.id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-white">{entity.name || entity.entity_name}</p>
                    {entity.entity_code && <span className="text-[10px] text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded">{entity.entity_code}</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${entity.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{entity.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  {entity.trading_name && <p className="text-xs text-zinc-500">Trading as: {entity.trading_name}</p>}
                  {entity.registration_number && <p className="text-[11px] text-zinc-600">Reg: {entity.registration_number} · VAT: {entity.vat_number || '—'} · {entity.accounting_mode || 'accrual'} · {entity.base_currency || 'ZAR'}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(entity)} className="text-[11px] text-zinc-500 hover:text-white transition-colors">Edit</button>
                  <button onClick={() => handleArchive(entity.id)} className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors">Archive</button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/[0.04]">
                {[
                  { label: 'Properties', value: stats[entity.id]?.properties || 0 },
                  { label: 'Tenants', value: stats[entity.id]?.tenants || 0 },
                  { label: 'Active Leases', value: stats[entity.id]?.leases || 0 },
                  { label: 'Users', value: stats[entity.id]?.users || 0 },
                ].map(s => (
                  <div key={s.label} className="text-center py-2">
                    <p className="text-lg font-light text-white">{s.value}</p>
                    <p className="text-[10px] text-zinc-600">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-white/[0.04] text-[9px] text-zinc-700">
                ID: {entity.id} · Created: {new Date(entity.created_at).toLocaleDateString('en-ZA')}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-8 max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-light text-white">{editingId ? 'Edit Entity' : 'Create Entity'}</h2>
                <button onClick={() => { setShowCreate(false); resetForm(); }} className="text-zinc-500 hover:text-white">✕</button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-600">Identity</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Entity Name *</label><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Entity Code</label><input value={entityCode} onChange={(e) => setEntityCode(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" placeholder="Auto-generated" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Trading Name</label><input value={tradingName} onChange={(e) => setTradingName(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Country</label><select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option>South Africa</option><option>Namibia</option><option>Botswana</option><option>Zimbabwe</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Registration Number</label><input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                  <div><label className="text-[10px] text-zinc-500 block mb-1">VAT Number</label><input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                </div>

                <p className="text-[10px] uppercase tracking-wider text-zinc-600 pt-2">Contact</p>
                <div><label className="text-[10px] text-zinc-500 block mb-1">Physical Address</label><input value={physicalAddress} onChange={(e) => setPhysicalAddress(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                <div><label className="text-[10px] text-zinc-500 block mb-1">Postal Address</label><input value={postalAddress} onChange={(e) => setPostalAddress(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Telephone</label><input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Website</label><input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                </div>

                <p className="text-[10px] uppercase tracking-wider text-zinc-600 pt-2">Financial Configuration</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Financial Year Start</label><select value={financialYearStart} onChange={(e) => setFinancialYearStart(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (<option key={m} value={i+1}>{m}</option>))}</select></div>
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Accounting Mode</label><select value={accountingMode} onChange={(e) => setAccountingMode(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="accrual">Accrual</option><option value="cash">Cash</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Base Currency</label><input value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" placeholder="ZAR" /></div>
                  <div><label className="text-[10px] text-zinc-500 block mb-1">Status</label><select value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowCreate(false); resetForm(); }} className="flex-1 rounded-lg border border-white/[0.08] py-2.5 text-xs font-medium text-white hover:border-white/20">Cancel</button>
                <button onClick={handleSave} disabled={!name} className="flex-1 rounded-lg bg-white py-2.5 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-40">{editingId ? 'Save Changes' : 'Create Entity'}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
