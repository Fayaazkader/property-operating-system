'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { leaseActivationService } from '@/lib/workflow/services/lease-activation-service';
import { documentExtractionProvider } from '@/lib/workflow/services/document-extraction-provider';
import { duplicateDetectionService } from '@/lib/workflow/services/duplicate-detection-service';
import { validationService } from '@/lib/workflow/services/validation-service';
import Link from 'next/link';
import { Upload, Camera, Edit3, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

type Step = 'choose' | 'upload' | 'extraction' | 'review' | 'manual' | 'processing' | 'complete';

export default function LeaseActivationPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('choose');
  const [entityId, setEntityId] = useState('');
  const [extractedFields, setExtractedFields] = useState<Record<string, { value: string; confidence: number }>>({});
  const [exceptions, setExceptions] = useState<Array<{ field: string; message: string; severity: string }>>([]);
  const [duplicates, setDuplicates] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [billableItems, setBillableItems] = useState<Array<{ id: string; description: string; amount: number; selected: boolean }>>([]);
  const [result, setResult] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/landing'); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (entities?.length) setEntityId(entities[0]);
      const { data: props } = await supabase.from('properties').select('id, property_name').eq('entity_id', entities?.[0] || '');
      setProperties(props || []);
    }
    init();
  }, []);

  async function loadUnits(propertyId: string) {
    const { data } = await supabase.from('units').select('id, unit_number, occupancy_status').eq('property_id', propertyId);
    setUnits(data || []);
  }

  async function handleUpload() {
    setStep('extraction');
    const result = await documentExtractionProvider.extract(new ArrayBuffer(0) as any, 'lease.pdf');
    setExtractedFields(result.fields);
    setExceptions(result.exceptions);
    setBillableItems([
      { id: 'rent', description: 'Base Rent', amount: parseFloat(result.fields.monthly_rental?.value || '0'), selected: true },
      { id: 'parking', description: 'Parking', amount: (parseInt(result.fields.parking_bays?.value || '0') * parseFloat(result.fields.parking_rate?.value || '0')), selected: true },
      { id: 'deposit', description: 'Deposit', amount: parseFloat(result.fields.deposit_amount?.value || '0'), selected: true },
    ]);
    const dup = await duplicateDetectionService.check(result.fields.tenant_name?.value || '', result.fields.vat_number?.value || '');
    setDuplicates(dup);
    const val = await validationService.validate({
      tenantName: result.fields.tenant_name?.value || '',
      vatNumber: result.fields.vat_number?.value || '',
      unitId: units[0]?.id || '',
      propertyId: properties[0]?.id || '',
      leaseStart: result.fields.lease_start_date?.value || '',
      leaseEnd: result.fields.lease_end_date?.value || '',
      entityId,
    });
    setValidationResult(val);
    setBlocked(val.isBlocking || dup.isBlocking);
    setStep('review');
  }

  async function handleActivate(data: any) {
    if (blocked) return;
    setStep('processing');
    try {
      const res = await leaseActivationService.execute({
        entityId,
        tenantName: data.tenant_name?.value || data.tenant_name,
        vatNumber: data.vat_number?.value || data.vat_number,
        email: data.email?.value || data.email,
        phone: data.phone?.value || data.phone,
        propertyId: data.property_id || properties[0]?.id,
        unitId: data.unit_id || units[0]?.id,
        monthlyRental: parseFloat(data.monthly_rental?.value || data.monthly_rental),
        leaseStartDate: data.lease_start_date?.value || data.lease_start_date,
        leaseEndDate: data.lease_end_date?.value || data.lease_end_date,
        escalationPercent: parseFloat(data.escalation_percent?.value || data.escalation_percent || '8'),
        depositAmount: parseFloat(data.deposit_amount?.value || data.deposit_amount || data.monthly_rental?.value || data.monthly_rental),
        parkingBays: parseInt(data.parking_bays?.value || data.parking_bays || '0'),
        parkingRate: parseFloat(data.parking_rate?.value || data.parking_rate || '850'),
        selectedBillableItems: billableItems.filter(b => b.selected).map(b => b.id),
      });
      setResult(res);
      setStep('complete');
    } catch (err: any) {
      alert(err.message);
      setStep('review');
    }
  }

  const getConfidenceColor = (c: number) => c >= 85 ? 'bg-emerald-500/10 text-emerald-400' : c >= 70 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400';
  const fieldLabel = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const manualForm = { tenant_name: '', vat_number: '', email: '', phone: '', property_id: '', unit_id: '', monthly_rental: '', lease_start_date: '', lease_end_date: '', escalation_percent: '8', deposit_amount: '', parking_bays: '0', parking_rate: '850' };
  const [manual, setManual] = useState(manualForm);

  return (
    <div className="min-h-screen bg-black flex">
      <div className="flex-1 p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <Link href="/tenants" className="text-sm text-zinc-500 hover:text-white">← Tenants</Link>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Add Tenant</h1>
        </div>

        {step === 'choose' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400 font-light mb-6">How would you like to create this tenant?</p>
            <button onClick={() => { setStep('upload'); setTimeout(handleUpload, 500); }} className="w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6 text-left hover:border-emerald-500/30 transition-all">
              <div className="flex items-start gap-4"><div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Upload className="w-5 h-5 text-emerald-400" /></div><div><p className="text-sm font-medium text-white">Upload Executed Lease <span className="text-[10px] text-emerald-400 ml-2">Recommended</span></p><p className="text-xs text-zinc-500 mt-1">Upload a PDF. AssetFlow extracts tenant, lease terms, and billing rules.</p></div></div>
            </button>
            <button onClick={() => setStep('manual')} className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 text-left hover:border-white/[0.1] transition-all">
              <div className="flex items-start gap-4"><div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Camera className="w-5 h-5 text-blue-400" /></div><div><p className="text-sm font-medium text-white">Scan Document</p><p className="text-xs text-zinc-500 mt-1">Use your camera to scan a paper lease.</p></div></div>
            </button>
            <button onClick={() => setStep('manual')} className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 text-left hover:border-white/[0.1] transition-all">
              <div className="flex items-start gap-4"><div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Edit3 className="w-5 h-5 text-amber-400" /></div><div><p className="text-sm font-medium text-white">Guided Capture</p><p className="text-xs text-zinc-500 mt-1">Enter details directly.</p></div></div>
            </button>
          </div>
        )}

        {step === 'extraction' && (
          <div className="flex items-center justify-center py-20"><div className="text-center space-y-4"><div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin mx-auto" /><p className="text-sm text-zinc-400 font-light">Extracting lease details...</p></div></div>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            <p className="text-sm text-zinc-400 font-light">Review before activation.</p>
            {blocked && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-red-400 mb-2 font-medium flex items-center gap-2"><XCircle className="w-3 h-3" /> Cannot proceed</p>
                {duplicates?.isBlocking && <p className="text-xs text-red-300/80 font-light">VAT number already exists.</p>}
                {validationResult?.checks?.filter((c: any) => !c.passed && c.blocking).map((c: any, i: number) => <p key={i} className="text-xs text-red-300/80 font-light">{c.message}</p>)}
              </div>
            )}
            {exceptions.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 mb-2 font-medium">Review Required</p>
                {exceptions.map((e, i) => <div key={i} className="flex items-center gap-2 text-xs text-amber-300/80 font-light"><AlertTriangle className="w-3 h-3" /> {e.message}</div>)}
              </div>
            )}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-medium">Company</p>
              {['tenant_name', 'company_registration', 'vat_number', 'email', 'phone'].map(key => extractedFields[key] && (
                <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg"><div><p className="text-[10px] text-zinc-600">{fieldLabel(key)}</p><p className="text-sm text-white font-light">{extractedFields[key].value}</p></div><span className={`text-[10px] px-2 py-0.5 rounded-full ${getConfidenceColor(extractedFields[key].confidence)}`}>{extractedFields[key].confidence}%</span></div>
              ))}
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-medium">Lease Terms</p>
              {['monthly_rental', 'lease_start_date', 'lease_end_date', 'escalation_percent', 'deposit_amount', 'parking_bays', 'parking_rate'].map(key => extractedFields[key] && (
                <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg"><div><p className="text-[10px] text-zinc-600">{fieldLabel(key)}</p><p className="text-sm text-white font-light">{extractedFields[key].value}</p></div><span className={`text-[10px] px-2 py-0.5 rounded-full ${getConfidenceColor(extractedFields[key].confidence)}`}>{extractedFields[key].confidence}%</span></div>
              ))}
            </div>
            {billableItems.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-medium">Billable Items</p>
                {billableItems.map(item => (
                  <label key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.02] cursor-pointer">
                    <span className="text-sm text-white font-light">{item.description} — R{item.amount.toLocaleString()}</span>
                    <input type="checkbox" checked={item.selected} onChange={() => setBillableItems(prev => prev.map(b => b.id === item.id ? { ...b, selected: !b.selected } : b))} className="rounded" />
                  </label>
                ))}
              </div>
            )}
            {validationResult && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-medium">Validation</p>
                {validationResult.checks.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    {c.passed ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : c.blocking ? <XCircle className="w-3 h-3 text-red-400" /> : <AlertTriangle className="w-3 h-3 text-amber-400" />}
                    <span className={`text-xs font-light ${c.passed ? 'text-zinc-400' : c.blocking ? 'text-red-400' : 'text-amber-400'}`}>{c.message}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => handleActivate(extractedFields)} disabled={blocked} className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">Confirm & Activate</button>
              <button onClick={() => setStep('manual')} className="rounded-xl border border-white/[0.08] px-6 py-3 text-sm text-zinc-400 hover:text-white">Edit</button>
            </div>
          </div>
        )}

        {step === 'manual' && (
          <form onSubmit={(e) => { e.preventDefault(); handleActivate(manual); }} className="space-y-6">
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Company</p>
              <input type="text" placeholder="Company Name *" value={manual.tenant_name} onChange={(e) => setManual({ ...manual, tenant_name: e.target.value })} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="VAT Number" value={manual.vat_number} onChange={(e) => setManual({ ...manual, vat_number: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
                <input type="email" placeholder="Email" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Property & Lease</p>
              <select value={manual.property_id} onChange={(e) => { setManual({ ...manual, property_id: e.target.value }); loadUnits(e.target.value); }} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20"><option value="">Select Property *</option>{properties.map(p => <option key={p.id} value={p.id}>{p.property_name}</option>)}</select>
              <select value={manual.unit_id} onChange={(e) => setManual({ ...manual, unit_id: e.target.value })} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20"><option value="">Select Unit *</option>{units.map(u => <option key={u.id} value={u.id}>{u.unit_number} — {u.occupancy_status}</option>)}</select>
              <input type="number" placeholder="Monthly Rental *" value={manual.monthly_rental} onChange={(e) => setManual({ ...manual, monthly_rental: e.target.value })} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={manual.lease_start_date} onChange={(e) => setManual({ ...manual, lease_start_date: e.target.value })} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
                <input type="date" value={manual.lease_end_date} onChange={(e) => setManual({ ...manual, lease_end_date: e.target.value })} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
              </div>
            </div>
            <button type="submit" className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100">Create Tenant & Lease</button>
          </form>
        )}

        {step === 'processing' && (
          <div className="flex items-center justify-center py-20"><div className="text-center space-y-4"><div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin mx-auto" /><p className="text-sm text-zinc-400 font-light">Activating lease...</p></div></div>
        )}

        {step === 'complete' && result && (
          <div className="space-y-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto"><CheckCircle className="w-7 h-7 text-emerald-400" /></div>
            <div><p className="text-lg font-light text-white">Activation Complete</p>
              <div className="mt-4 space-y-1 text-sm text-zinc-400 font-light">
                <p>✓ Tenant created — {result.tenantCode}</p>
                <p>✓ Lease created — {result.leaseRef}</p>
                <p>✓ {result.rulesCreated} billing rules</p>
                <p>✓ {result.chargesGenerated} charges generated</p>
                {result.contactsCreated > 0 && <p>✓ Contact saved</p>}
                {result.documentsAttached > 0 && <p>✓ Document attached</p>}
              </div>
            </div>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button onClick={() => router.push(`/tenants/${result.tenantId}`)} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100">View Tenant</button>
              <button onClick={() => router.push('/financials/revenue')} className="w-full rounded-xl border border-white/[0.08] py-3 text-sm text-zinc-400 hover:text-white">Revenue Operations</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
