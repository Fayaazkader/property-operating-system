"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { provisionInitialWorkspace, type WorkspaceDetails } from '@/lib/onboarding/service';

const emptyDetails: WorkspaceDetails = { fullName: '', clientName: '', entityName: '', entityCode: '', roleName: '' };

export default function SignupPage() {
  const [details, setDetails] = useState(emptyDetails);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    setChecking(true);
    setCheckFailed(false);
    setAuthenticated(false);
    setError('');
    async function load() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) return;
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Your session could not be verified. Sign in again.');
        if (!active) return;
        setAuthenticated(true);
        setEmail(user.email ?? '');
        // Metadata is only a form draft, never an authorization decision.
        const draft = user.user_metadata?.workspace_draft ?? {};
        setDetails(current => Object.fromEntries(Object.entries(current).map(([key, value]) =>
          [key, value || (typeof draft[key] === 'string' ? draft[key] : '')])) as WorkspaceDetails);
      } catch {
        if (active) { setCheckFailed(true); setError('We could not check your account. Retry or sign in again before continuing.'); }
      } finally {
        if (active) setChecking(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      if (!authenticated) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/signup`,
            data: { full_name: details.fullName.trim(), workspace_draft: details },
          },
        });
        if (signupError) throw signupError;
        if (!data.session) {
          setPassword('');
          setNotice('Check your email to confirm your account, then sign in to finish workspace setup. If you already have an account, sign in instead. No workspace has been created by this request.');
          return;
        }
        setAuthenticated(true); setPassword('');
      }
      await provisionInitialWorkspace(supabase, details);
      // Reload canonical providers after membership creation; no stale empty scope.
      window.location.assign('/app');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Setup could not be confirmed. Please retry.');
    } finally {
      submitting.current = false; setBusy(false);
    }
  }

  const inputClass = 'w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/70';
  return (
    <main className="min-h-screen bg-black px-4 py-10 sm:py-16 text-white">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/landing" className="text-2xl font-semibold tracking-tight focus-visible:outline focus-visible:outline-2">AssetFlow</Link>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-8">
          <h1 className="text-2xl font-semibold">{authenticated ? 'Finish your workspace setup' : 'Create your AssetFlow workspace'}</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300">Set up a new client account and its first legal entity. You will be its initial Super User. Joining an existing organisation? Ask its administrator for access instead.</p>
          {checking ? <p role="status" className="mt-6">Checking your account…</p> : checkFailed ? null : (
            <form onSubmit={submit} className="mt-6 space-y-4" aria-busy={busy}>
              <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
                {([
                  ['fullName', 'Your full name', 'name'],
                  ['clientName', 'Client / organisation name', 'organization'],
                  ['entityName', 'First legal entity name', 'off'],
                  ['entityCode', 'Legal entity code (unique reference)', 'off'],
                  ['roleName', 'Your organisational role', 'organization-title'],
                ] as const).map(([key, label, autoComplete]) => <div key={key}>
                  <label htmlFor={key} className="mb-1.5 block text-sm text-zinc-200">{label}</label>
                  <input id={key} autoComplete={autoComplete} required maxLength={200} value={details[key]} onChange={e => setDetails({ ...details, [key]: e.target.value })} className={inputClass} />
                </div>)}
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm text-zinc-200">Work email</label>
                  <input id="email" type="email" autoComplete="email" required readOnly={authenticated} value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
                </div>
                {!authenticated && <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm text-zinc-200">Password</label>
                  <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} aria-describedby="password-help" />
                  <p id="password-help" className="mt-1 text-xs text-zinc-400">At least 8 characters.</p>
                </div>}
                <button type="submit" className="w-full rounded-xl bg-white px-4 py-3 font-medium text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50">{busy ? 'Confirming workspace setup…' : authenticated ? 'Complete workspace setup' : 'Create account and continue'}</button>
              </fieldset>
            </form>
          )}
          {error && <div role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"><p>{error}</p><button type="button" disabled={busy} onClick={() => setAttempt(a => a + 1)} className="mt-3 underline">Recheck account</button></div>}
          {notice && <p role="status" className="mt-4 rounded-xl border border-white/20 p-4 text-sm leading-6">{notice}</p>}
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link href="/login" className="underline">Sign in</Link>
            {authenticated && <Link href="/app" className="underline">Open existing workspace</Link>}
            <Link href="/landing" className="text-zinc-300 underline">Back to AssetFlow</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
