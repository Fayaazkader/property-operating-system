"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkWorkspaceAccess } from '@/lib/onboarding/service';
import { trackEvent, AnalyticsEvents } from '@/lib/analytics/tracker';
import '@/lib/events';
import { FeedbackProvider } from '@/components/ui/FeedbackProvider';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'allowed' | 'unassigned' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setState('loading');
    const db = createClient();
    async function check() {
      try {
        const result = await checkWorkspaceAccess(db);
        if (!active) return;
        if (result === 'signed-out') { router.replace('/login'); return; }
        setState(result);
      } catch {
        if (active) {
          setError('We could not verify your workspace access. No portfolio data has been opened. Retry or sign in again.');
          setState('error');
        }
      }
    }
    void check();
    // Session expiry/sign-out must close the UI, even without a navigation.
    const { data: { subscription } } = db.auth.onAuthStateChange((event) => {
      if (active && event === 'SIGNED_OUT') { setState('loading'); router.replace('/login'); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [router, attempt]);

  useEffect(() => {
    if (state === 'allowed') trackEvent(AnalyticsEvents.PAGE_VIEW, undefined, { path: pathname });
  }, [pathname, state]);

  if (state === 'allowed') return <FeedbackProvider>{children}</FeedbackProvider>;
  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[var(--bg-primary)] px-6 py-16 flex items-center justify-center">
      <div className="w-full max-w-md text-center">
        <Link href="/landing" className="text-xl font-semibold">AssetFlow</Link>
        {state === 'loading' ? <p role="status" className="mt-6 text-[var(--text-secondary)]">Verifying workspace access…</p> : <>
          <h1 className="mt-6 text-2xl font-semibold">{state === 'error' ? 'Access could not be verified' : 'Your workspace is not connected yet'}</h1>
          <p role={state === 'error' ? 'alert' : 'status'} className="mt-4 text-[var(--text-secondary)] leading-relaxed">
            {state === 'error' ? error : 'If you are starting a new organisation, complete your workspace setup. If you are joining an existing organisation, ask its administrator to assign your access.'}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {state === 'unassigned' && <Link href="/signup" className="rounded-xl bg-white px-4 py-3 font-medium text-black">Set up a new workspace</Link>}
            <button onClick={() => setAttempt(a => a + 1)} className="rounded-xl border border-[var(--border-default)] px-4 py-3">Check access again</button>
            <Link href="/login" className="py-2 underline">Sign in with another account</Link>
          </div>
        </>}
      </div>
    </div>
  );
}
