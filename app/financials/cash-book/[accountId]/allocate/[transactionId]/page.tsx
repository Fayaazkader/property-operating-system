'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/app/components/layout/PageHeader';
import { CustomDropdown } from '@/components/ui';

type AllocationLine = {
  id: string;
  target: 'tenant_invoice' | 'supplier_invoice' | 'property' | 'entity' | 'deposit' | 'gl_only';
  tenant_id?: string;
  supplier_id?: string;
  property_id?: string;
  entity_id?: string;
  gl_code: string;
  amount: number;
};

export default function TransactionAllocationWorkspace() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.accountId as string;
  const transactionId = params.transactionId as string;

  const [transaction, setTransaction] = useState<any>(null);
  const [allocations, setAllocations] = useState<AllocationLine[]>([
    { id: crypto.randomUUID(), target: 'tenant_invoice', gl_code: '', amount: 0 }
  ]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [glCodes, setGlCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: tx } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();
      setTransaction(tx);

      const [tenantsRes, suppliersRes, propertiesRes, entitiesRes, glRes] = await Promise.all([
        supabase.from('tenants').select('id, tenant_name, code').order('tenant_name'),
        supabase.from('suppliers').select('id, supplier_name, code').order('supplier_name'),
        supabase.from('properties').select('id, property_name, code').order('property_name'),
        supabase.from('entities').select('id, entity_name, entity_code').order('entity_name'),
        supabase.from('gl_codes').select('id, code, description').eq('is_active', true).order('code'),
      ]);

      setTenants(tenantsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setProperties(propertiesRes.data || []);
      setEntities(entitiesRes.data || []);
      setGlCodes(glRes.data || []);

      setLoading(false);
    }
    loadData();
  }, [accountId, transactionId]);

  const totalAllocated = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  const remaining = Math.abs(transaction?.transaction_amount || 0) - totalAllocated;

  const addAllocation = () => {
    setAllocations([
      ...allocations,
      { id: crypto.randomUUID(), target: 'tenant_invoice', gl_code: '', amount: 0 }
    ]);
  };

  const removeAllocation = (id: string) => {
    if (allocations.length <= 1) return;
    setAllocations(allocations.filter(a => a.id !== id));
  };

  const updateAllocation = (id: string, field: keyof AllocationLine, value: any) => {
    setAllocations(allocations.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    ));
  };

  const handleSave = async () => {
    for (const alloc of allocations) {
      if (alloc.amount <= 0) continue;
      if (!alloc.gl_code) continue;
      
      await supabase.from('transaction_allocations').insert({
        transaction_id: transactionId,
        target: alloc.target,
        tenant_id: alloc.target === 'tenant_invoice' ? alloc.tenant_id : null,
        supplier_id: alloc.target === 'supplier_invoice' ? alloc.supplier_id : null,
        property_id: alloc.target === 'property' ? alloc.property_id : null,
        entity_id: alloc.target === 'entity' ? alloc.entity_id : null,
        amount: alloc.amount,
        gl_code: alloc.gl_code,
      });
    }

    await supabase
      .from('bank_transactions')
      .update({ 
        allocation_status: 'ready_to_post',
        queue: 'ready',
        allocated_amount: totalAllocated 
      })
      .eq('id', transactionId);

    router.push(`/financials/cash-book/${accountId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader 
        title="Transaction Allocation" 
        subtitle={transaction ? `${transaction.transaction_description} — R${Math.abs(transaction.transaction_amount).toLocaleString()}` : 'Loading...'}
      />

      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
        <div className="space-y-3">
          {allocations.map((alloc, index) => (
            <div key={alloc.id} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)] flex-wrap">
              <span className="text-xs text-[var(--text-muted)] font-mono w-8">{index + 1}</span>

              <CustomDropdown
                value={alloc.target}
                onChange={(val) => updateAllocation(alloc.id, 'target', val as AllocationLine['target'])}
                options={[
                  { value: 'tenant_invoice', label: 'Tenant Invoice' },
                  { value: 'supplier_invoice', label: 'Supplier Invoice' },
                  { value: 'property', label: 'Property' },
                  { value: 'entity', label: 'Entity' },
                  { value: 'deposit', label: 'Deposit' },
                  { value: 'gl_only', label: 'GL Code Only' },
                ]}
                className="w-[160px]"
              />

              {alloc.target === 'tenant_invoice' && (
                <CustomDropdown
                  value={alloc.tenant_id || ''}
                  onChange={(val) => updateAllocation(alloc.id, 'tenant_id', val)}
                  options={[
                    { value: '', label: 'Select tenant...' },
                    ...tenants.map(t => ({ value: t.id, label: `${t.tenant_name} (${t.code})` }))
                  ]}
                  className="flex-1 min-w-[180px]"
                />
              )}

              {alloc.target === 'supplier_invoice' && (
                <CustomDropdown
                  value={alloc.supplier_id || ''}
                  onChange={(val) => updateAllocation(alloc.id, 'supplier_id', val)}
                  options={[
                    { value: '', label: 'Select supplier...' },
                    ...suppliers.map(s => ({ value: s.id, label: `${s.supplier_name} (${s.code})` }))
                  ]}
                  className="flex-1 min-w-[180px]"
                />
              )}

              {alloc.target === 'property' && (
                <CustomDropdown
                  value={alloc.property_id || ''}
                  onChange={(val) => updateAllocation(alloc.id, 'property_id', val)}
                  options={[
                    { value: '', label: 'Select property...' },
                    ...properties.map(p => ({ value: p.id, label: `${p.property_name} (${p.code})` }))
                  ]}
                  className="flex-1 min-w-[180px]"
                />
              )}

              {alloc.target === 'entity' && (
                <CustomDropdown
                  value={alloc.entity_id || ''}
                  onChange={(val) => updateAllocation(alloc.id, 'entity_id', val)}
                  options={[
                    { value: '', label: 'Select entity...' },
                    ...entities.map(e => ({ value: e.id, label: `${e.entity_name} (${e.entity_code})` }))
                  ]}
                  className="flex-1 min-w-[180px]"
                />
              )}

              {(alloc.target === 'tenant_invoice' || alloc.target === 'supplier_invoice' || alloc.target === 'property' || alloc.target === 'entity' || alloc.target === 'deposit') && (
                <CustomDropdown
                  value={alloc.gl_code || ''}
                  onChange={(val) => updateAllocation(alloc.id, 'gl_code', val)}
                  options={[
                    { value: '', label: 'GL Code...' },
                    ...glCodes.map(g => ({ value: g.code, label: `${g.code} - ${g.description}` }))
                  ]}
                  className="w-[160px]"
                />
              )}

              {alloc.target === 'gl_only' && (
                <CustomDropdown
                  value={alloc.gl_code || ''}
                  onChange={(val) => updateAllocation(alloc.id, 'gl_code', val)}
                  options={[
                    { value: '', label: 'Select GL Code...' },
                    ...glCodes.map(g => ({ value: g.code, label: `${g.code} - ${g.description}` }))
                  ]}
                  className="flex-1 min-w-[180px]"
                />
              )}

              <input
                type="number"
                value={alloc.amount || ''}
                onChange={(e) => updateAllocation(alloc.id, 'amount', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-[120px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2 text-sm text-[var(--text-primary)] tabular-nums outline-none focus:border-[var(--border-hover)]"
              />

              <button
                onClick={() => removeAllocation(alloc.id)}
                className="text-[var(--text-muted)] hover:text-red-400 transition p-1"
                disabled={allocations.length <= 1}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addAllocation}
          className="mt-4 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition flex items-center gap-1"
        >
          + Add Split
        </button>

        <div className="mt-6 pt-4 border-t border-[var(--border-default)] flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-[var(--text-muted)]">
              Transaction Total: <span className="text-[var(--text-primary)] font-medium tabular-nums">R{Math.abs(transaction?.transaction_amount || 0).toLocaleString('en-ZA')}</span>
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Allocated: <span className="text-emerald-400 font-medium tabular-nums">R{totalAllocated.toLocaleString()}</span>
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Remaining: <span className={`font-medium tabular-nums ${remaining === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                R{remaining.toLocaleString()}
              </span>
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-2xl border border-[var(--border-default)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={remaining !== 0 || allocations.some(a => !a.gl_code)}
              className={`rounded-2xl px-8 py-3 text-sm font-semibold transition ${
                remaining === 0 && !allocations.some(a => !a.gl_code)
                  ? 'bg-[var(--text-primary)] text-black hover:opacity-90'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed'
              }`}
            >
              Confirm Allocation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}