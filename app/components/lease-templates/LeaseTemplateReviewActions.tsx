'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Props {
  templateId: string;
}

export default function LeaseTemplateReviewActions({
  templateId,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState<'approve' | 'reject' | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function approveTemplate() {
    try {
      setLoading('approve');
      setError(null);

      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await fetch(
        `/api/lease-templates/${templateId}/approve`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || 'Unable to approve lease template.'
        );
      }

      router.push('/settings/lease-templates');
      router.refresh();
    } catch (error) {
      console.error(
        '[LEASE TEMPLATE REVIEW] Approval failed:',
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : 'Unable to approve lease template.'
      );
    } finally {
      setLoading(null);
    }
  }

  async function rejectTemplate() {
    // Rejection will be wired to the dedicated rejection workflow.
    setError(
      'Rejection workflow is not yet connected.'
    );
  }

  return (
    <div className="flex items-center justify-between border-t border-white/[0.06] pt-6">
      <button
        type="button"
        onClick={() => router.back()}
        disabled={loading !== null}
        className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
      >
        Back
      </button>

      <div className="flex items-end gap-3">
        {error && (
          <p className="max-w-md text-xs text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={rejectTemplate}
          disabled={loading !== null}
          className="rounded-lg border border-red-400/20 px-4 py-2.5 text-sm text-red-400 transition hover:bg-red-400/[0.05] disabled:opacity-50"
        >
          {loading === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>

        <button
          type="button"
          onClick={approveTemplate}
          disabled={loading !== null}
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === 'approve'
            ? 'Approving…'
            : 'Approve Template'}
        </button>
      </div>
    </div>
  );
}