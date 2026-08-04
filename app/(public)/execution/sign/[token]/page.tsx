'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { 
  CheckCircle, 
  XCircle, 
  FileText, 
  PenLine, 
  User, 
  Calendar, 
  Clock, 
  AlertCircle,
  Building2,
  DollarSign,
  Shield,
  Download,
  ExternalLink,
  Check,
  Users
} from "lucide-react";
import SignaturePad from "@/app/components/signing/SignaturePad";

export default function SigningPage() {
  const { token } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<any>(null);
  const [execution, setExecution] = useState<any>(null);
  const [sourceData, setSourceData] = useState<any>(null);
  const [signature, setSignature] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string; details?: string } | null>(null);
  const [executionStatus, setExecutionStatus] = useState<string>('');

  useEffect(() => {
    loadSigningData();
  }, [token]);

  async function loadSigningData() {
    try {
      const { data: participantData, error: pError } = await supabase
        .from('execution_participants')
        .select('*')
        .eq('otp_code', token)
        .single();

      if (pError || !participantData) {
        setError('Invalid or expired signing link');
        setLoading(false);
        return;
      }

      const { data: executionData, error: eError } = await supabase
        .from('executions')
        .select('*')
        .eq('id', participantData.execution_id)
        .single();

      if (eError || !executionData) {
        setError('Execution not found');
        setLoading(false);
        return;
      }

      if (participantData.status === 'signed') {
        setSigned(true);
        setParticipant(participantData);
        setExecution(executionData);
        setExecutionStatus(executionData.status);
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
      setExecutionStatus(executionData.status);

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
        details: 'Type or draw your signature in the field below.'
      });
      return;
    }

    if (!agreed) {
      setNotification({
        type: 'error',
        message: 'Please agree to the terms',
        details: 'You must confirm your agreement before signing.'
      });
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      // Update the fetch call
const response = await fetch(`/api/execution/${execution.id}/sign`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    participant_id: participant.id,
    signature: signature,
    signature_method: 'typed', // or 'drawn' based on mode
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }),
});

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign');
      }

      setSigned(true);
      setSignature('');
      setExecutionStatus(data.status);
      
      if (data.status === 'executed') {
        setNotification({
          type: 'success',
          message: '🎉 All parties have signed!',
          details: 'The lease has been executed and will now activate.'
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

  function formatDate(date: string) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-ZA', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  }

  function formatCurrency(amount: number) {
    if (!amount) return 'N/A';
    return `R${amount.toLocaleString('en-ZA')}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[var(--text-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-muted)] text-sm">Loading lease agreement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
        <div className="max-w-md w-full bg-[var(--bg-secondary)] rounded-2xl border border-red-500/20 p-8 text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Link Invalid</h2>
          <p className="text-sm text-[var(--text-muted)] mt-2">{error}</p>
          <p className="text-xs text-[var(--text-muted)] mt-4">Please contact the leasing manager for assistance.</p>
        </div>
      </div>
    );
  }

  if (signed) {
    const isExecuted = executionStatus === 'executed' || executionStatus === 'activated';
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
        <div className="max-w-md w-full bg-[var(--bg-secondary)] rounded-2xl border border-emerald-500/20 p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-400">Already Signed</h2>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            You have already signed this lease on {formatDate(participant?.signed_at)}.
          </p>
          {isExecuted && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm text-emerald-400 font-medium">✅ All parties have signed</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">The lease has been fully executed.</p>
            </div>
          )}
          <button 
            onClick={() => window.close()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Check className="w-4 h-4" />
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header with Branding */}
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--text-primary)] flex items-center justify-center">
              <span className="text-[var(--bg-primary)] font-bold text-lg">AF</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">AssetFlow</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Secure Signing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-[var(--text-muted)]">Secured</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Notification */}
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

        {/* Progress Indicator */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Review & Sign Lease Agreement</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Please review the lease terms below and sign to confirm your agreement.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-xs text-[var(--text-secondary)]">Review</span>
            </div>
            <div className="w-12 h-px bg-[var(--border-default)]" />
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-xs text-[var(--text-secondary)]">Sign</span>
            </div>
            <div className="w-12 h-px bg-[var(--border-default)]" />
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${executionStatus === 'executed' ? 'bg-emerald-400' : 'bg-[var(--bg-elevated)]'}`} />
              <span className={`text-xs ${executionStatus === 'executed' ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
                Complete
              </span>
            </div>
          </div>
        </div>

        {/* Lease Summary Card */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] overflow-hidden mb-6">
          <div className="p-6 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--text-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Lease Summary</h3>
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Lease Reference</p>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                {sourceData?.lease_id || sourceData?.id?.substring(0, 8) || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Monthly Rental</p>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-1 tabular-nums">
                {formatCurrency(sourceData?.monthly_rental)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Term</p>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                {sourceData?.lease_term_months || 'N/A'} months
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Commencement</p>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
                {formatDate(sourceData?.commencement_date)}
              </p>
            </div>
          </div>
        </div>

        {/* Participant Info */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
              <User className="w-5 h-5 text-[var(--text-muted)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Signing as</p>
              <p className="text-base font-semibold text-[var(--text-primary)]">{participant?.name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {participant?.participant_type?.toUpperCase()} · 
                {executionStatus === 'executed' ? ' Executed' : ' Pending'}
              </p>
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] p-6 mb-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <PenLine className="w-4 h-4 text-[var(--text-muted)]" />
            Your Signature
          </h3>

          <SignaturePad 
            value={signature}
            onChange={setSignature}
            onClear={() => setSignature('')}
            
          />

          {/* Agreement Checkbox */}
          <div className="mt-4 flex items-start gap-3">
            <input
              type="checkbox"
              id="agreement"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:ring-[var(--text-primary)] focus:ring-offset-0"
            />
            <label htmlFor="agreement" className="text-xs text-[var(--text-secondary)] leading-relaxed">
              I confirm that I have reviewed the lease terms and conditions. I understand that this is a legally binding agreement and my signature represents my full acceptance of the terms outlined above.
            </label>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            </div>
          )}

          <button
            onClick={handleSign}
            disabled={isSigning || !signature.trim() || !agreed}
            className="mt-4 w-full rounded-xl bg-emerald-600 text-white px-6 py-3.5 text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSigning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Sign Lease Agreement
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-xs text-[var(--text-muted)]">
            This is a legally binding agreement. By signing, you agree to the terms and conditions.
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            Your signature will be timestamped and audited. IP address and device information will be recorded.
          </p>
          <p className="text-[10px] text-[var(--text-muted)] mt-4">
            © {new Date().getFullYear()} AssetFlow. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
