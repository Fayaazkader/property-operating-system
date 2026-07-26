'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [provisionStep, setProvisionStep] = useState('');
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !email || !companyName || !password) {
      setError('Please fill in all required fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');
    setProvisioning(true);

    try {
      // Step 1: Create auth user
      setProvisionStep('Creating your account...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, company_name: companyName } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Signup failed');

      // Step 2: Create workspace entity
      setProvisionStep('Creating your workspace...');
      const { data: entity, error: entityError } = await supabase
        .from('entities')
        .insert({ name: companyName })
        .select('id')
        .single();
      if (entityError) throw entityError;

      // Step 3: Assign company administrator
      setProvisionStep('Setting up administrator...');
      await supabase.from('user_entity_access').insert({
        user_id: authData.user.id,
        entity_id: entity.id,
        org_role: 'entity_admin',
      });

      // Step 4: Create profile
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        display_name: fullName,
        email,
        mobile_number: mobile || null,
        platform_role: 'company_admin',
      });

      // Step 5: Seed financial defaults
      setProvisionStep('Configuring financial operations...');
      await seedDefaults(entity.id);

      // Step 6: Sign in and redirect
      setProvisionStep('Welcome to AssetFlow...');
      setTimeout(() => router.push('/welcome'), 1000);
    } catch (err: any) {
      setProvisioning(false);
      setError(err.message || 'Something went wrong. Please try again or contact support.');
    }
    setLoading(false);
  }

  if (provisioning) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/[0.04]">
            <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
          <p className="text-lg font-light text-white">Creating your workspace</p>
          <p className="text-sm text-zinc-500 font-light">{provisionStep}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold tracking-tight text-white">AssetFlow</Link>
          <p className="text-sm text-zinc-500 mt-2 font-light">The operating system for commercial property.</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-8">
          <h1 className="text-xl font-semibold text-white text-center mb-6">Create your workspace</h1>

          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-colors" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Company Name</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-colors" placeholder="Acme Properties" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Work Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-colors" placeholder="you@company.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Mobile Number (optional)</label>
              <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-colors" placeholder="+27 82 123 4567" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20 transition-colors" placeholder="Min 8 characters" />
            </div>

            {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3"><p className="text-sm text-red-400">{error}</p></div>}

            <button type="submit" disabled={loading} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Already have an account? <Link href="/login" className="text-white hover:text-zinc-300 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

async function seedDefaults(entityId: string) {
  const { supabase } = await import('@/lib/supabase');

  // Chart of Accounts
  const { data: templateCOA } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('entity_id', '00000000-0000-0000-0000-000000000000');
  if (templateCOA?.length) {
    await supabase.from('chart_of_accounts').insert(
      templateCOA.map((row: any) => ({ ...row, id: crypto.randomUUID(), entity_id: entityId }))
    );
  }

  // Posting Templates
  const { data: templates } = await supabase
    .from('posting_templates')
    .select('*, lines:posting_template_lines(*)')
    .eq('entity_id', '00000000-0000-0000-0000-000000000000');
  if (templates?.length) {
    for (const tmpl of templates) {
      const { data: newT } = await supabase.from('posting_templates')
        .insert({ entity_id: entityId, business_event: tmpl.business_event, description: tmpl.description, priority: tmpl.priority, is_active: true })
        .select('id').single();
      if (newT && tmpl.lines?.length) {
        await supabase.from('posting_template_lines').insert(
          tmpl.lines.map((l: any) => ({ template_id: newT.id, sequence: l.sequence, direction: l.direction, account_resolver: l.account_resolver, amount_formula: l.amount_formula, vat_treatment: l.vat_treatment }))
        );
      }
    }
  }

  // Financial Periods
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();
  const firstDay = new Date(year, now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(year, now.getMonth() + 1, 0).toISOString().split('T')[0];
  await supabase.from('financial_periods').insert([
    { entity_id: entityId, period_type: 'financial', period_name: `${month} ${year} Financial`, period_start: firstDay, period_end: lastDay, status: 'open' },
    { entity_id: entityId, period_type: 'statement', period_name: `Statement ${month} ${year}`, period_start: firstDay, period_end: lastDay, status: 'open' },
  ]);

  // Invoice & Statement configs
  await supabase.from('invoice_configs').insert({ entity_id: entityId });
  await supabase.from('statement_configs').insert({ entity_id: entityId });
}
