'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/app/components/layout/PageHeader';
import { CustomDropdown } from '@/components/ui';

type AllocationLine = {
  id: string;
  type: 'tenant' | 'property' | 'gl' | 'supplier';
  tenant_id?: string;
  property_id?: string;
  supplier_id?: string;
  invoice_id?: string;
  gl_code: string;
  amount: number;
};

export default function TransactionAllocationWorkspace() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.accountId as string;
  const transactionId = params.transactionId as string;

  const [transaction, setTransaction] = useState<any>(null);
  const [allocations, setAllocations] = useState<AllocationLine[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [glCodes, setGlCodes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPayment, setIsPayment] = useState(false);
  const [showInvoiceSelector, setShowInvoiceSelector] = useState<string | null>(null);

  useEffect(() => {
   async function loadData() {
  const { data: tx } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', transactionId)
    .single();
  setTransaction(tx);
  
  const amount = tx?.transaction_amount || 0;
  setIsPayment(amount < 0);

  // Get user's entities (for reference)
  const { data: { user } } = await supabase.auth.getUser();
  const { data: userEntities } = await supabase
    .from('user_entities')
    .select('entity_id')
    .eq('user_id', user?.id);

  const entityIds = userEntities?.map(e => e.entity_id) || [];

  // Fetch data (no entity filtering for now)
  const [tenantsRes, propertiesRes, glRes] = await Promise.all([
    supabase.from('tenants').select('id, tenant_name, entity_id').order('tenant_name'),
   supabase.from('properties').select('id, property_name, entity_id').order('property_name'),
    supabase.from('gl_codes').select('id, code, description').eq('is_active', true).order('code'),
  ]);

  setTenants(tenantsRes.data || []);
  setProperties(propertiesRes.data || []);
  setGlCodes(glRes.data || []);
  setSuppliers([]);
  setInvoices([]);

  setAllocations([
    { id: crypto.randomUUID(), type: isPayment ? 'supplier' : 'tenant', gl_code: '', amount: Math.abs(amount) }
  ]);

  setLoading(false);
}
    loadData();
  }, [accountId, transactionId]);

  const totalAllocated = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  const remaining = Math.abs(transaction?.transaction_amount || 0) - totalAllocated;

  const addAllocation = () => {
    setAllocations([
      ...allocations,
      { id: crypto.randomUUID(), type: isPayment ? 'supplier' : 'tenant', gl_code: '', amount: 0 }
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
    if (alloc.type === 'property' && !alloc.gl_code) continue;
    if (alloc.type === 'gl' && !alloc.gl_code) continue;
    
    await supabase.from('transaction_allocations').insert({
      transaction_id: transactionId,
      type: alloc.type,
      tenant_id: alloc.type === 'tenant' ? alloc.tenant_id : null,
      supplier_id: alloc.type === 'supplier' ? alloc.supplier_id : null,
      property_id: alloc.type === 'property' ? alloc.property_id : null,
      invoice_id: alloc.invoice_id || null,
      amount: alloc.amount,
      gl_code: alloc.gl_code || null,
      is_payment: isPayment,
    });
  }

  const { data: updateData, error: updateError } = await supabase
    .from('bank_transactions')
    .update({ 
      allocation_status: 'ready_to_post',
      queue: 'ready',
    })
    .eq('id', transactionId);

  console.log('Update result:', updateData);
  console.log('Update error:', updateError);

  router.push(`/financials/cash-book/${accountId}`);
};

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  const receiptOptions = [
    { value: 'tenant', label: 'Tenant' },
    { value: 'property', label: 'Property' },
    { value: 'gl', label: 'GL Code' },
  ];

  const paymentOptions = [
    { value: 'supplier', label: 'Supplier' },
    { value: 'tenant', label: 'Tenant Refund' },
    { value: 'property', label: 'Property' },
    { value: 'gl', label: 'GL Code' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader 
        title={isPayment ? "Payment Allocation" : "Receipt Allocation"} 
        subtitle={transaction ? `${transaction.transaction_description} — R${Math.abs(transaction.transaction_amount).toLocaleString('en-ZA')}` : 'Loading...'}
      />

      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
        <div className="space-y-3">
          {allocations.map((alloc, index) => {
            const supplierInvoices = invoices.filter(inv => inv.supplier_id === alloc.supplier_id);
            
            return (
              <div key={alloc.id} className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                <span className="text-xs text-[var(--text-muted)] font-mono w-8">{index + 1}</span>

                <CustomDropdown
                  value={alloc.type}
                  onChange={(val) => updateAllocation(alloc.id, 'type', val as AllocationLine['type'])}
                  options={isPayment ? paymentOptions : receiptOptions}
                  className="w-[160px]"
                />

                {alloc.type === 'tenant' && (
                  <CustomDropdown
                    value={alloc.tenant_id || ''}
                    onChange={(val) => updateAllocation(alloc.id, 'tenant_id', val)}
                    options={[
                      { value: '', label: 'Select tenant...' },
                      ...tenants.map(t => ({ value: t.id, label: t.tenant_name }))
                    ]}
                    className="flex-1 min-w-[180px]"
                  />
                )}

                {alloc.type === 'supplier' && (
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    <CustomDropdown
                      value={alloc.supplier_id || ''}
                      onChange={(val) => {
                        updateAllocation(alloc.id, 'supplier_id', val);
                        updateAllocation(alloc.id, 'invoice_id', '');
                        setShowInvoiceSelector(alloc.id);
                      }}
                      options={[
                        { value: '', label: 'Select supplier...' },
                        ...suppliers.map(s => ({ value: s.id, label: `${s.supplier_name} (${s.code})` }))
                      ]}
                      className="min-w-[180px] flex-1"
                    />
                    
                    {alloc.supplier_id && supplierInvoices.length > 0 && (
                      <CustomDropdown
                        value={alloc.invoice_id || ''}
                        onChange={(val) => updateAllocation(alloc.id, 'invoice_id', val)}
                        options={[
                          { value: '', label: 'Select invoice...' },
                          ...supplierInvoices.map(inv => ({ 
                            value: inv.id, 
                            label: `${inv.invoice_number} — R${inv.outstanding_amount?.toLocaleString('en-ZA') || inv.total_amount?.toLocaleString('en-ZA')}`
                          }))
                        ]}
                        className="min-w-[180px] flex-1"
                      />
                    )}
                    
                    {alloc.supplier_id && supplierInvoices.length === 0 && (
                      <span className="text-xs text-amber-400">No outstanding invoices. Create one below.</span>
                    )}
                  </div>
                )}

                {alloc.type === 'property' && (
                  <>
                    <CustomDropdown
                      value={alloc.property_id || ''}
                      onChange={(val) => updateAllocation(alloc.id, 'property_id', val)}
                      options={[
                        { value: '', label: 'Select property...' },
                        ...properties.map(p => ({ value: p.id, label: `${p.property_name} (${p.code})` }))
                      ]}
                      className="flex-1 min-w-[180px]"
                    />
                    <CustomDropdown
                      value={alloc.gl_code || ''}
                      onChange={(val) => updateAllocation(alloc.id, 'gl_code', val)}
                      options={[
                        { value: '', label: 'Select GL Code...' },
                        ...glCodes.map(g => ({ value: g.code, label: `${g.code} - ${g.description}` }))
                      ]}
                      className="w-[160px]"
                    />
                  </>
                )}

                {alloc.type === 'gl' && (
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
            );
          })}
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
              Allocated: <span className="text-emerald-400 font-medium tabular-nums">R{totalAllocated.toLocaleString('en-ZA')}</span>
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Remaining: <span className={`font-medium tabular-nums ${remaining === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                R{remaining.toLocaleString('en-ZA')}
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
              disabled={remaining !== 0 || allocations.some(a => 
                (a.type === 'property' && !a.gl_code) || 
                (a.type === 'gl' && !a.gl_code) ||
                (a.type === 'supplier' && !a.supplier_id)
              )}
              className={`rounded-2xl px-8 py-3 text-sm font-semibold transition ${
                remaining === 0 && !allocations.some(a => 
                  (a.type === 'property' && !a.gl_code) || 
                  (a.type === 'gl' && !a.gl_code) ||
                  (a.type === 'supplier' && !a.supplier_id)
                )
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