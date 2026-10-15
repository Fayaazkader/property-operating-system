'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import WorkflowDialog from '@/app/components/ui/WorkflowDialog';
import { permissionService } from '@/lib/rbac/permission-service';

export default function BillingPoliciesPage() {
  const sequence=useRef(0);const [entities,setEntities]=useState<Array<{id:string;entity_name:string}>>([]);
  const [taxes,setTaxes]=useState<Array<{tax_code:string;tax_name:string;tax_rate:number}>>([]);
  const [canManage,setCanManage]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [entityId, setEntityId] = useState('');
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = {
    policy_name: '',
    policy_type: 'commercial',
    lease_fee_amount: 0,
    lease_fee_tax_code: '',
    lease_fee_vat_treatment: '',
    lease_fee_description: 'Standard Commercial Lease Fee',
    late_payment_type: 'percentage',
    late_payment_value: 10,
    late_payment_description: 'Late Payment Fee',
    deposit_months: 1,
    billing_day: 25,
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    async function init(){
      try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Sign in to review billing policies');
        const {data:ids,error}=await supabase.rpc('auth_entities');if(error||!ids?.length)throw new Error('No authorized billing entity available');
        const result=await supabase.from('entities').select('id,entity_name').in('id',ids).order('entity_name');if(result.error||!result.data?.length)throw new Error('Unable to load authorized entities');
        setEntities(result.data);setEntityId(result.data[0].id);await loadPolicies(result.data[0].id);
      }catch(caught){setError(caught instanceof Error?caught.message:'Unable to load policies');}finally{setLoading(false);}
    }void init();
  }, []);

  async function loadPolicies(eid:string){
    const current=++sequence.current;setCanManage(false);setError('');
    const [policyResult,taxResult,sessionResult]=await Promise.all([supabase.from('billing_policies').select('*').eq('entity_id',eid).order('policy_type'),supabase.from('tax_config').select('tax_code,tax_name,tax_rate').eq('entity_id',eid).eq('is_active',true).order('tax_code'),supabase.auth.getSession()]);
    const allowed=sessionResult.data.session?await permissionService.can(sessionResult.data.session.user.id,eid,'finance.billing_policy.manage'):{allowed:false};
    if(current!==sequence.current)return;
    if(policyResult.error||taxResult.error){setError('Unable to load entity policies or tax configuration. Reload to retry.');setPolicies([]);setTaxes([]);setCanManage(false);return;}
    setPolicies(policyResult.data??[]);setTaxes(taxResult.data??[]);setCanManage(allowed.allowed);
  }

  function handleEdit(policy: any) {
    setForm({
      policy_name: policy.policy_name,
      policy_type: policy.policy_type,
      lease_fee_amount: policy.lease_fee_amount,
      lease_fee_tax_code: policy.lease_fee_tax_code??'',
      lease_fee_vat_treatment: policy.lease_fee_vat_treatment??'',
      lease_fee_description: policy.lease_fee_description || '',
      late_payment_type: policy.late_payment_type,
      late_payment_value: policy.late_payment_value,
      late_payment_description: policy.late_payment_description || '',
      deposit_months: policy.deposit_months,
      billing_day: policy.billing_day,
    });
    setEditingId(policy.id);
    setShowForm(true);
  }

  async function handleSave(){
    if(busy||!canManage)return;setError('');
    if(!form.policy_name.trim()||!Number.isFinite(form.lease_fee_amount)||form.lease_fee_amount<0){setError('Enter a policy name and a valid fee amount.');return;}
    if(form.lease_fee_amount>0&&(!form.lease_fee_tax_code||!form.lease_fee_vat_treatment)){setError('Select the lease fee tax code and VAT treatment.');return;}
    setBusy(true);
    try{const data={...form,entity_id:entityId,lease_fee_tax_code:form.lease_fee_tax_code||null,lease_fee_vat_treatment:form.lease_fee_vat_treatment||null};
      const result=editingId?await supabase.from('billing_policies').update(data).eq('id',editingId).eq('entity_id',entityId):await supabase.from('billing_policies').insert(data);
      if(result.error)throw new Error(result.error.message);setShowForm(false);setEditingId(null);setForm(emptyForm);await loadPolicies(entityId);
    }catch(caught){setError(caught instanceof Error?caught.message:'Policy save failed. Your input is preserved.');}finally{setBusy(false);}
  }
  async function handleDelete(id:string){if(busy||!canManage)return;setBusy(true);setError('');try{const {error}=await supabase.from('billing_policies').delete().eq('id',id).eq('entity_id',entityId);if(error)throw new Error(error.message);await loadPolicies(entityId);}catch(caught){setError(caught instanceof Error?caught.message:'Unable to delete policy');}finally{setBusy(false);}}

  if (loading) return <p role="status" className="p-8">Loading billing configuration…</p>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Settings</Link>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-[var(--text-primary)]">Billing Policies</h1>
        </div>
        <button disabled={busy||!canManage} onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="af-control rounded-xl bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100 transition-all">
          + New Policy
        </button>
      </div>

      {error&&!showForm&&<div role="alert" className="space-y-2"><p>{error}</p><button className="af-control" onClick={()=>void loadPolicies(entityId)}>Reload policies</button></div>}
      <label className="block text-sm">Billing entity<select aria-label="Billing entity" className="af-control mt-2 block bg-[var(--bg-secondary)]" disabled={busy} value={entityId} onChange={e=>{setEntityId(e.target.value);setShowForm(false);setEditingId(null);void loadPolicies(e.target.value);}}>{entities.map(entity=><option key={entity.id} value={entity.id}>{entity.entity_name}</option>)}</select></label>
      {!canManage&&<p className="text-sm text-[var(--text-secondary)]">Policy changes require the billing policy management capability for this entity.</p>}
      {/* Policy List */}
      <div className="space-y-3">
        {policies.map(policy => (
          <div key={policy.id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{policy.policy_name}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-[var(--text-secondary)] capitalize">{policy.policy_type}</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-[var(--text-secondary)]">Lease Fee</p>
                    <p className="text-[var(--text-primary)] font-light">R{policy.lease_fee_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)]">Late Payment</p>
                    <p className="text-[var(--text-primary)] font-light">{policy.late_payment_type === 'percentage' ? `${policy.late_payment_value}%` : `R${policy.late_payment_value?.toLocaleString()}`}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)]">Deposit</p>
                    <p className="text-[var(--text-primary)] font-light">{policy.deposit_months} month(s)</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)]">Billing Day</p>
                    <p className="text-[var(--text-primary)] font-light">{policy.billing_day}th</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button disabled={busy||!canManage} onClick={() => handleEdit(policy)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Edit</button>
                <button disabled={busy||!canManage} onClick={() => void handleDelete(policy.id)} className="text-xs text-red-500 hover:text-red-400">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <WorkflowDialog title={editingId?'Edit billing policy':'New billing policy'} busy={busy} onClose={()=>setShowForm(false)}>
          {error&&<p role="alert" className="mb-4 text-sm text-[var(--danger)]">{error}</p>}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Policy Name</label>
                    <input type="text" value={form.policy_name} onChange={(e) => setForm({ ...form, policy_name: e.target.value })} className="af-control w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Type</label>
                    <select value={form.policy_type} onChange={(e) => setForm({ ...form, policy_type: e.target.value })} className="af-control w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-white/20">
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="retail">Retail</option>
                      <option value="residential">Residential</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-3 font-medium">Lease Fee</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Amount (R)</label>
                      <input type="number" value={form.lease_fee_amount} onChange={(e) => setForm({ ...form, lease_fee_amount: parseFloat(e.target.value) || 0 })} className="af-control w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-white/20" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Description</label>
                      <input type="text" value={form.lease_fee_description} onChange={(e) => setForm({ ...form, lease_fee_description: e.target.value })} className="af-control w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-white/20" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">Lease fee tax code<select aria-label="Lease fee tax code" className="af-control mt-2 block w-full bg-[var(--bg-secondary)]" value={form.lease_fee_tax_code} onChange={e=>setForm({...form,lease_fee_tax_code:e.target.value})}><option value="">Select explicit tax classification</option>{taxes.map((tax,index)=><option key={tax.tax_code+index} value={tax.tax_code}>{tax.tax_name} ({tax.tax_rate}%)</option>)}</select></label>
                  <label className="text-sm">Lease fee VAT treatment<select aria-label="Lease fee VAT treatment" className="af-control mt-2 block w-full bg-[var(--bg-secondary)]" value={form.lease_fee_vat_treatment} onChange={e=>setForm({...form,lease_fee_vat_treatment:e.target.value})}><option value="">Select treatment</option><option value="exclusive">Amount excludes VAT</option><option value="inclusive">Amount includes VAT</option><option value="not_applicable">VAT not applicable</option></select></label>
                </div>
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-3 font-medium">Late Payment Fee</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Type</label>
                      <select value={form.late_payment_type} onChange={(e) => setForm({ ...form, late_payment_type: e.target.value })} className="af-control w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-white/20">
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">{form.late_payment_type === 'percentage' ? '%' : 'Amount (R)'}</label>
                      <input type="number" value={form.late_payment_value} onChange={(e) => setForm({ ...form, late_payment_value: parseFloat(e.target.value) || 0 })} className="af-control w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-white/20" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Description</label>
                      <input type="text" value={form.late_payment_description} onChange={(e) => setForm({ ...form, late_payment_description: e.target.value })} className="af-control w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-white/20" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-3 font-medium">Deposit</p>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Months</label>
                    <input type="number" value={form.deposit_months} onChange={(e) => setForm({ ...form, deposit_months: parseInt(e.target.value) || 1 })} className="af-control w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-white/20" />
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-3 font-medium">Billing Calendar</p>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Billing Day (1-28)</label>
                    <input type="number" value={form.billing_day} onChange={(e) => setForm({ ...form, billing_day: parseInt(e.target.value) || 25 })} min={1} max={28} className="af-control w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-white/20" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button disabled={busy} onClick={()=>void handleSave()} className="flex-1 rounded-xl bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100 transition-all">{busy?'Saving…':'Save Policy'}</button>
                <button disabled={busy} onClick={() => setShowForm(false)} className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">Cancel</button>
              </div>
        </WorkflowDialog>
      )}
    </div>
  );
}
