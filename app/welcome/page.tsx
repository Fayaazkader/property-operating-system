'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const STEPS = [
  { key: 'workspace', label: 'Workspace Created', done: true },
  { key: 'property', label: 'Add your first Property', done: false },
  { key: 'premises', label: 'Add a Premises', done: false },
  { key: 'tenant', label: 'Add your first Tenant', done: false },
  { key: 'lease', label: 'Create your first Lease', done: false },
];

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<string[]>(['workspace']);
  const [loading, setLoading] = useState(false);

  // Property fields
  const [propertyName, setPropertyName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyGLA, setPropertyGLA] = useState('');

  // Premises fields
  const [premisesName, setPremisesName] = useState('');
  const [premisesGLA, setPremisesGLA] = useState('');

  // Tenant fields
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');

  // Lease fields
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [monthlyRental, setMonthlyRental] = useState('');

  // Created IDs for linking
  const [propertyId, setPropertyId] = useState('');
  const [premisesId, setPremisesId] = useState('');
  const [tenantId, setTenantId] = useState('');

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
    }
    check();
  }, []);

  async function handleCreateProperty() {
    if (!propertyName) return;
    setLoading(true);
    const { data: entityIds } = await supabase.rpc('auth_entities');
    const entityId = entityIds?.[0];
    
    const { data } = await supabase.from('properties').insert({
      property_name: propertyName,
      physical_address: propertyAddress || null,
      entity_id: entityId,
      gla_sqm: parseFloat(propertyGLA) || null,
    }).select('id').single();

    if (data) {
      setPropertyId(data.id);
      setCompleted([...completed, 'property']);
      nextStep();
    }
    setLoading(false);
  }

  async function handleCreatePremises() {
    if (!premisesName || !propertyId) return;
    setLoading(true);
    const { data } = await supabase.from('units').insert({
      unit_name: premisesName,
      property_id: propertyId,
      gla_sqm: parseFloat(premisesGLA) || null,
      occupancy_status: 'Vacant',
    }).select('id').single();

    if (data) {
      setPremisesId(data.id);
      setCompleted([...completed, 'premises']);
      nextStep();
    }
    setLoading(false);
  }

  async function handleCreateTenant() {
    if (!tenantName) return;
    setLoading(true);
    const { data: entityIds } = await supabase.rpc('auth_entities');
    const entityId = entityIds?.[0];

    const { data } = await supabase.from('tenants').insert({
      tenant_name: tenantName,
      email: tenantEmail || null,
      phone: tenantPhone || null,
      entity_id: entityId,
    }).select('id').single();

    if (data) {
      setTenantId(data.id);
      setCompleted([...completed, 'tenant']);
      nextStep();
    }
    setLoading(false);
  }

  async function handleCreateLease() {
    if (!monthlyRental || !tenantId || !propertyId) return;
    setLoading(true);
    const { data: entityIds } = await supabase.rpc('auth_entities');
    const entityId = entityIds?.[0];

    await supabase.from('leases').insert({
      tenant_id: tenantId,
      tenant_name: tenantName,
      property_id: propertyId,
      property_name: propertyName,
      unit_number: premisesName || null,
      monthly_rental: parseFloat(monthlyRental),
      lease_start_date: leaseStart || null,
      lease_end_date: leaseEnd || null,
      lease_status: 'Active',
      owner_entity_id: entityId,
      managing_entity_id: entityId,
      billing_frequency: 'monthly',
    });

    setCompleted([...completed, 'lease']);
    nextStep();
    setLoading(false);
  }

  function nextStep() {
    setStep(step + 1);
  }

  function handleFinish() {
    router.push('/');
  }

  const currentStep = step < STEPS.length ? STEPS[step] : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="relative w-full max-w-lg">
        <div className="text-center mb-6">
          <p className="text-2xl font-bold tracking-tight text-white">AssetFlow</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-8">
          
          {/* Progress */}
          <div className="flex items-center gap-1.5 mb-8 justify-center">
            {STEPS.map((s, i) => (
              <div key={s.key} className={`h-1 flex-1 rounded-full transition-all ${completed.includes(s.key) ? 'bg-emerald-500' : i === step ? 'bg-white/30' : 'bg-white/[0.06]'}`} />
            ))}
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-2">
                <span className="text-2xl">✓</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Welcome to AssetFlow</h1>
                <p className="text-sm text-zinc-500 mt-2 font-light">Your workspace is ready. Let's build your portfolio.</p>
              </div>
              <button onClick={nextStep} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all">
                Continue
              </button>
            </div>
          )}

          {/* Step 1: Property */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Step 1</p>
              <h1 className="text-xl font-semibold text-white">Add your first Property</h1>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Property Name</label>
                <input type="text" value={propertyName} onChange={(e) => setPropertyName(e.target.value)} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20" placeholder="Sandton Mall" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Address</label>
                <input type="text" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20" placeholder="1 Rivonia Road, Sandton" />
              </div>
              <button onClick={handleCreateProperty} disabled={loading || !propertyName} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
                {loading ? 'Creating...' : 'Create Property'}
              </button>
            </div>
          )}

          {/* Step 2: Premises */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Step 2</p>
              <h1 className="text-xl font-semibold text-white">Add a Premises</h1>
              <p className="text-sm text-zinc-500">{propertyName}</p>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Unit/Suite Name</label>
                <input type="text" value={premisesName} onChange={(e) => setPremisesName(e.target.value)} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20" placeholder="Suite 101" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">GLA (m²)</label>
                <input type="number" value={premisesGLA} onChange={(e) => setPremisesGLA(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20" placeholder="150" />
              </div>
              <button onClick={handleCreatePremises} disabled={loading || !premisesName} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
                {loading ? 'Creating...' : 'Add Premises'}
              </button>
              <button onClick={nextStep} className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Skip for now</button>
            </div>
          )}

          {/* Step 3: Tenant */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Step 3</p>
              <h1 className="text-xl font-semibold text-white">Add your first Tenant</h1>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Tenant Name</label>
                <input type="text" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20" placeholder="Acme Corp" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Email</label>
                  <input type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20" placeholder="tenant@acme.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Phone</label>
                  <input type="text" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20" placeholder="+27 11 123 4567" />
                </div>
              </div>
              <button onClick={handleCreateTenant} disabled={loading || !tenantName} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
                {loading ? 'Creating...' : 'Add Tenant'}
              </button>
              <button onClick={nextStep} className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Skip for now</button>
            </div>
          )}

          {/* Step 4: Lease */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Step 4</p>
              <h1 className="text-xl font-semibold text-white">Create your first Lease</h1>
              <p className="text-sm text-zinc-500">{tenantName} — {propertyName} {premisesName}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Start Date</label>
                  <input type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">End Date</label>
                  <input type="date" value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Monthly Rental (R)</label>
                <input type="number" value={monthlyRental} onChange={(e) => setMonthlyRental(e.target.value)} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20" placeholder="25000" />
              </div>
              <button onClick={handleCreateLease} disabled={loading || !monthlyRental || !tenantId || !propertyId} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
                {loading ? 'Creating...' : 'Create Lease'}
              </button>
              <button onClick={nextStep} className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Skip for now</button>
            </div>
          )}

          {/* Done */}
          {step >= 5 && (
            <div className="space-y-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-2">
                <span className="text-2xl">✓</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">You're all set</h1>
                <p className="text-sm text-zinc-500 mt-2 font-light">You've created your first commercial property portfolio.</p>
              </div>
              <div className="text-left bg-white/[0.02] rounded-xl p-4 space-y-1.5 text-sm">
                {completed.map(k => {
                  const s = STEPS.find(x => x.key === k);
                  return (
                    <p key={k} className="text-emerald-400 font-light flex items-center gap-2">
                      <span className="text-xs">✓</span> {s?.label}
                    </p>
                  );
                })}
              </div>
              <button onClick={handleFinish} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all">
                Enter AssetFlow
              </button>
            </div>
          )}
        </div>

        {step > 0 && step < 5 && (
          <p className="mt-4 text-center">
            <button onClick={handleFinish} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Skip setup, go to dashboard</button>
          </p>
        )}
      </div>
    </div>
  );
}
