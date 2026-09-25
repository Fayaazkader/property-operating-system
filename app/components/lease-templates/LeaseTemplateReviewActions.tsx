'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Props {
  templateId: string;
  entityId: string;
  canApprove: boolean;
  approvalBlockedReason?: string | null;
}

export default function LeaseTemplateReviewActions({
  templateId,
  entityId,
  canApprove,
  approvalBlockedReason = null,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] =
    useState<'approve' | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  async function approveTemplate() {
    if (!canApprove || loading !== null) {
      return;
    }

    try {
      setLoading('approve');
      setError(null);

      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          'Your session has expired. Please sign in again.'
        );
      }

      const response = await fetch(
        `/api/lease-templates/${templateId}/approve`,
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entityId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            'Unable to approve lease template.'
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

  return (
    <div className="flex items-start justify-between gap-6 border-t border-white/[0.06] pt-6">
      <button
        type="button"
        onClick={() => router.back()}
        disabled={loading !== null}
        className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
      >
        Back
      </button>

      <div className="flex max-w-xl flex-col items-end gap-2">
        {error && (
          <p className="text-right text-xs text-red-400">
            {error}
          </p>
        )}

        {!canApprove && approvalBlockedReason && (
          <p className="text-right text-xs leading-5 text-amber-400/80">
            {approvalBlockedReason}
          </p>
        )}

        <button
          type="button"
          onClick={approveTemplate}
          disabled={!canApprove || loading !== null}
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading === 'approve'
            ? 'Approving…'
            : 'Approve Template'}
        </button>
      </div>
    </div>
  );
}
