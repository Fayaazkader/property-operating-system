'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/app/components/layout/PageHeader';
import { CustomDropdown } from '@/components/ui';

type AllocationLine = {
  id: string;
  layer: 'entity' | 'tenant' | 'property';
  entity_id?: string;
  tenant_id?: string;
  property_id?: string;
  gl_code: string;
  amount: number;
};

export default function AllocationWorkspace() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.accountId as string;
  const transactionId = params.transactionId as string;

  const [transaction, setTransaction] = useState<any>(null);
  const [allocations, setAllocations] = useState<AllocationLine[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [glCodes, setGlCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      // Get transaction
      const { data: tx } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();
      setTransaction(tx);

      // Auto-create first allocation with full amount
      if (tx) {
        setAllocations([
          { 
            id: crypto.randomUUID(), 
            layer: 'tenant', 
            gl_code: '', 
            amount: Math.abs(tx.transaction_amount),
          }
        ]);
      }

      // Get entities
      const { data: entitiesData } = await supabase
        .from('entities')
        .select('id, entity_name, entity_code')
        .order('entity_name');
      setEntities(entitiesData || []);

      // Get tenants
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('id, tenant_name, code')
        .order('tenant_name');
      setTenants(tenantsData || []);

      // Get properties
      const { data: propertiesData } = await supabase
        .from('properties')
        .select('id, property_name, code')
        .order('property_name');
      setProperties(propertiesData || []);

      // Get GL codes
      const { data: glData } = await supabase
  .from('gl_codes')
  .select('id, code, description')
  .eq('is_active', true)
  .order('code');
      setGlCodes(glData || []);

      setLoading(false);
    }
    loadData();
  }, [accountId, transactionId]);

  const totalAllocated = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalAmount = Math.abs(transaction?.transaction_amount || 0);
  const remainingAmount = totalAmount - totalAllocated;

  const addSplit = () => {
    setAllocations([
      ...allocations,
      { 
        id: crypto.randomUUID(), 
        layer: 'tenant', 
        gl_code: '', 
        amount: 0,
      }
    ]);
  };

  const fillRemainder = (id: string) => {
    setAllocations(allocations.map(a => 
      a.id === id ? { ...a, amount: remainingAmount } : a
    ));
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
        entity_id: alloc.layer === 'entity' ? alloc.entity_id : null,
        tenant_id: alloc.layer === 'tenant' ? alloc.tenant_id : null,
        property_id: alloc.layer === 'property' ? alloc.property_id : null,
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
        title="Manual Allocation" 
        subtitle={transaction ? `${transaction.transaction_description} — R${Math.abs(transaction.transaction_amount).toLocaleString()}` : 'Loading...'}
      />

      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
        {/* Transaction Details */}
        <div className="mb-6 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Description</p>
              <p className="text-[var(--text-primary)] font-medium">{transaction?.transaction_description}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Total Amount</p>
              <p className="text-[var(--text-primary)] font-medium tabular-nums">R{totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Allocation Lines */}
        <div className="space-y-3">
          {allocations.map((alloc, index) => (
            <div key={alloc.id} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)] flex-wrap">
              <span className="text-xs text-[var(--text-muted)] font-mono w-8">{index + 1}</span>

              <CustomDropdown
                value={alloc.layer}
                onChange={(val) => updateAllocation(alloc.id, 'layer', val as 'entity' | 'tenant' | 'property')}
                options={[
                  { value: 'entity', label: '🏢 Entity' },
                  { value: 'tenant', label: '👤 Tenant' },
                  { value: 'property', label: '🏠 Property' },
                ]}
                className="w-[140px]"
              />

              {alloc.layer === 'entity' && (
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

              {alloc.layer === 'tenant' && (
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

              {alloc.layer === 'property' && (
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

              <CustomDropdown
                value={alloc.gl_code || ''}
                onChange={(val) => updateAllocation(alloc.id, 'gl_code', val)}
                options={[
                  { value: '', label: 'Select GL Code...' },
                  ...glCodes.map(g => ({ 
  value: g.code, 
  label: `${g.code} - ${g.description}` 
}))
                ]}
                className="w-[160px]"
              />

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={alloc.amount || ''}
                  onChange={(e) => updateAllocation(alloc.id, 'amount', parseFloat(e.target.value) || 0)}
                  className="w-[120px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2 text-sm text-[var(--text-primary)] tabular-nums outline-none focus:border-[var(--border-hover)]"
                />
                {allocations.length > 1 && remainingAmount > 0 && (
                  <button
                    onClick={() => fillRemainder(alloc.id)}
                    className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] px-2 py-1 rounded-xl border border-[var(--border-default)] hover:border-[var(--accent)] transition whitespace-nowrap"
                  >
                    Remainder
                  </button>
                )}
              </div>

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

        {/* Add Split Button */}
        {remainingAmount > 0 && (
          <button
            onClick={addSplit}
            className="mt-4 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition flex items-center gap-2"
          >
            + Add Split
            <span className="text-xs text-[var(--text-muted)]">(R{remainingAmount.toLocaleString()} remaining)</span>
          </button>
        )}

        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-[var(--border-default)] flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-[var(--text-muted)]">
              Allocated: <span className="text-emerald-400 font-medium tabular-nums">R{totalAllocated.toLocaleString()}</span>
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Remaining: <span className={`font-medium tabular-nums ${remainingAmount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                R{remainingAmount.toLocaleString()}
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
              disabled={remainingAmount !== 0 || allocations.some(a => !a.gl_code)}
              className={`rounded-2xl px-8 py-3 text-sm font-semibold transition ${
                remainingAmount === 0 && !allocations.some(a => !a.gl_code)
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