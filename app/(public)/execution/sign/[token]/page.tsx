'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, FileText, PenLine, User, Calendar, Clock, AlertCircle } from "lucide-react";

export default function SigningPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<any>(null);
  const [execution, setExecution] = useState<any>(null);
  const [sourceData, setSourceData] = useState<any>(null);
  const [signature, setSignature] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string; details?: string } | null>(null);

  useEffect(() => {
    loadSigningData();
  }, [token]);

  async function loadSigningData() {
    try {
      console.log('Token from URL:', token);
      
      // Find the participant
      const { data: participantData, error: pError } = await supabase
        .from('execution_participants')
        .select('*')
        .eq('otp_code', token)
        .single();

      if (pError || !participantData) {
        console.error('Participant not found:', pError);
        setError('Invalid or expired signing link');
        setLoading(false);
        return;
      }

      console.log('Found participant:', participantData.name);

      // Get the execution
      const { data: executionData, error: eError } = await supabase
        .from('executions')
        .select('*')
        .eq('id', participantData.execution_id)
        .single();

      if (eError || !executionData) {
        console.error('Execution not found:', eError);
        setError('Execution not found');
        setLoading(false);
        return;
      }

      console.log('Found execution:', executionData.id, 'Status:', executionData.status);

      if (participantData.status === 'signed') {
        setSigned(true);
        setParticipant(participantData);
        setExecution(executionData);
        setLoading(false);
        return;
      }

      if (executionData.status === 'cancelled') {
        setError('This execution has been cancelled');
        setLoading(false);
        return;
      }

      setParticipant(participantData);
      setExecution(executionData);

      if (executionData.source_type === 'lease') {
        const { data: source } = await supabase
          .from('leases')
          .select('*')
          .eq('id', executionData.source_id)
          .single();
        setSourceData(source);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading signing data:', err);
      setError('Failed to load signing data');
      setLoading(false);
    }
  }

  async function handleSign() {
    if (!signature.trim()) {
      setNotification({
        type: 'error',
        message: 'Please enter your signature',
        details: 'Type your full name in the signature field.'
      });
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      console.log('Signing with:', { execution_id: execution.id, participant_id: participant.id });

      const response = await fetch(`/api/execution/${execution.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participant.id,
          signature: signature,
        }),
      });

      const data = await response.json();
      console.log('Sign response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign');
      }

      setSigned(true);
      setSignature('');
      
      if (data.status === 'executed') {
        setNotification({
          type: 'success',
          message: '🎉 All parties have signed!',
          details: 'The lease has been executed.'
        });
      } else {
        setNotification({
          type: 'success',
          message: '✅ Signature recorded!',
          details: 'Waiting for other parties to sign.'
        });
      }
    } catch (err) {
      console.error('Sign error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign');
    } finally {
      setIsSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--text-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-muted)]">Loading execution...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
        <div className="max-w-md w-full bg-[var(--bg-secondary)] rounded-2xl border border-red-500/20 p-8 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Link Invalid</h2>
          <p className="text-sm text-[var(--text-muted)] mt-2">{error}</p>
          <p className="text-xs text-[var(--text-muted)] mt-4">Please contact the leasing manager for assistance.</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
        <div className="max-w-md w-full bg-[var(--bg-secondary)] rounded-2xl border border-emerald-500/20 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-emerald-400">Already Signed</h2>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            You have already signed this lease.
          </p>
          {execution?.status === 'executed' && (
            <p className="text-sm text-emerald-400 mt-2">✅ The lease has been fully executed.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-[var(--bg-primary)]">
      <div className="max-w-3xl mx-auto">
        {notification && (
          <div className={`mb-6 p-4 rounded-xl ${
            notification.type === 'success' 
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            <p className="text-sm font-medium">{notification.message}</p>
            {notification.details && (
              <p className="text-xs mt-1 opacity-80">{notification.details}</p>
            )}
          </div>
        )}

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Review & Sign Lease</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Please review the lease agreement below before signing.
          </p>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Lease Reference</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {sourceData?.lease_id || sourceData?.id || 'N/A'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--text-muted)]">Status</p>
              <span className="text-xs font-medium text-blue-400">Awaiting Signature</span>
            </div>
          </div>
        </div>

        {sourceData && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] p-6 mb-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Lease Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Monthly Rental</p>
                <p className="text-sm font-medium text-[var(--text-primary)] tabular-nums">
                  R{sourceData.monthly_rental?.toLocaleString() || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Deposit</p>
                <p className="text-sm font-medium text-[var(--text-primary)] tabular-nums">
                  R{sourceData.deposit_amount?.toLocaleString() || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Term</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {sourceData.lease_term_months || 'N/A'} months
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Commencement</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {sourceData.commencement_date ? new Date(sourceData.commencement_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] p-6 mb-6">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-[var(--text-muted)]" />
            <div>
              <p className="text-xs text-[var(--text-muted)]">Signing as</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{participant?.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{participant?.participant_type?.toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] p-6 mb-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <PenLine className="w-4 h-4 text-[var(--text-muted)]" />
            Your Signature
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-muted)]">Type your full name</label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-3 text-sm outline-none focus:border-[var(--border-hover)] mt-1"
                disabled={isSigning}
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                By typing your name, you agree to the terms of this lease agreement.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              </div>
            )}

            <button
              onClick={handleSign}
              disabled={isSigning || !signature.trim()}
              className="w-full rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSigning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Sign Lease
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">
            This is a legally binding agreement. By signing, you agree to the terms and conditions.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Your signature will be timestamped and audited.
          </p>
        </div>
      </div>
    </div>
  );
}
