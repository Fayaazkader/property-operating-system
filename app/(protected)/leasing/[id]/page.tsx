'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save, Send, CheckCircle, FileText, AlertTriangle, Clock, Loader2, X } from "lucide-react";

export default function LeaseIntakeWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  const [intake, setIntake] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string; details?: string } | null>(null);

  useEffect(() => { loadIntake(); }, [id]);

  async function loadIntake() {
    const { data } = await supabase.from("lease_intake").select("*").eq("id", id).single();
    setIntake(data);
    setLoading(false);
  }

  async function updateField(field: string, value: any) {
    setIntake((prev: any) => ({ ...prev, [field]: value }));
  }

  async function saveIntake() {
    setSaving(true);
    await supabase.from("lease_intake").update({
      applicant_name: intake.applicant_name,
      company_registration: intake.company_registration,
      contact_email: intake.contact_email,
      contact_phone: intake.contact_phone,
      monthly_rental: intake.monthly_rental,
      deposit_amount: intake.deposit_amount,
      escalation_percent: intake.escalation_percent,
      lease_term_months: intake.lease_term_months,
      commencement_date: intake.commencement_date,
      expiry_date: intake.expiry_date,
      parking_bays: intake.parking_bays,
      negotiation_notes: intake.negotiation_notes,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    setSaving(false);
  }

  async function advanceStatus(newStatus: string) {
    await supabase.from("lease_intake").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
    loadIntake();
  }

  async function handleActivate() {
  setActivating(true);
  setNotification(null);
  
  try {
    // Get the session using the imported supabase client
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error(`Session error: ${sessionError.message}`);
    }

    if (!session) {
      throw new Error("Not authenticated. Please log in again.");
    }

    const token = session.access_token;
    console.log('Token obtained, length:', token.length);

    const response = await fetch(`/api/leasing/intake/${id}/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log('API Response:', data);
    
    if (!response.ok) {
      const errorMessage = data?.error || data?.message || data?.details || "Activation failed";
      throw new Error(errorMessage);
    }
    
    setShowActivationModal(false);
    await loadIntake();
    
    setNotification({
      type: 'success',
      message: '✅ Lease activated successfully!',
      details: data.lease_id ? `Lease ID: ${data.lease_id}` : 'Revenue operations have been initiated.'
    });
    
    setTimeout(() => {
      setNotification(null);
      router.refresh();
    }, 5000);
    
  } catch (error) {
    console.error("Activation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Activation failed";
    setNotification({
      type: 'error',
      message: errorMessage,
      details: 'Check the console for more details.'
    });
  } finally {
    setActivating(false);
  }
}

  const statusFlow = [
    { key: "awaiting_review", label: "Review", icon: Clock },
    { key: "under_negotiation", label: "Negotiate", icon: AlertTriangle },
    { key: "awaiting_signature", label: "Signature", icon: FileText },
    { key: "fully_executed", label: "Executed", icon: CheckCircle },
    { key: "ready_for_activation", label: "Activate", icon: CheckCircle },
  ];

  if (loading) return <div className="p-8 text-[var(--text-muted)]">Loading...</div>;
  if (!intake) return <div className="p-8 text-[var(--text-muted)]">Intake not found</div>;

  const currentStep = statusFlow.findIndex(s => s.key === intake.status);
  const isActivated = intake.status === "activated";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 pt-8 pb-12">
      {/* Notification - Center Screen Overlay */}
      {notification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`max-w-md w-full rounded-3xl border p-6 shadow-2xl ${
            notification.type === 'success' 
              ? 'border-emerald-500/30 bg-[var(--bg-secondary)]' 
              : 'border-red-500/30 bg-[var(--bg-secondary)]'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-base font-semibold ${
                  notification.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {notification.message}
                </p>
                {notification.details && (
                  <p className="text-sm text-[var(--text-muted)] mt-2">{notification.details}</p>
                )}
              </div>
              <button 
                onClick={() => setNotification(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>
            {notification.type === 'success' && (
              <button 
                onClick={() => {
                  setNotification(null);
                  router.refresh();
                }}
                className="mt-4 w-full rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                Continue
              </button>
            )}
            {notification.type === 'error' && (
              <button 
                onClick={() => setNotification(null)}
                className="mt-4 w-full rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors"><ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" /></button>
          <div>
            <p className="text-xs font-mono text-[var(--text-muted)]">{intake.intake_code}</p>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{intake.applicant_name || "New Lease Intake"}</h1>
            {isActivated && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full mt-1">
                <CheckCircle className="w-3 h-3" /> Activated
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveIntake} disabled={saving || isActivated} className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </button>
          {!isActivated && intake.status !== "ready_for_activation" && (
            <button onClick={() => advanceStatus("ready_for_activation")} className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-5 py-2 text-sm font-semibold hover:opacity-90 transition-opacity">
              <Send className="w-4 h-4" /> Advance
            </button>
          )}
        </div>
      </div>

      {/* Status Pipeline */}
      <div className="flex items-center gap-1">
        {statusFlow.map((s, i) => {
          const isActive = i <= currentStep;
          const isCurrent = i === currentStep;
          const isPast = i < currentStep;
          return (
            <div key={s.key} className="flex items-center gap-1">
              <button 
                onClick={() => !isActivated && advanceStatus(s.key)} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActivated ? 'bg-emerald-500/20 text-emerald-400 cursor-default' :
                  isCurrent ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 
                  isPast ? 'bg-emerald-500/10 text-emerald-300' : 
                  'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                }`}
                disabled={isActivated}
              >
                <s.icon className="w-3 h-3" /> {isActivated && i === statusFlow.length - 1 ? 'Activated' : s.label}
              </button>
              {i < statusFlow.length - 1 && <span className="text-[var(--text-muted)] text-xs">→</span>}
            </div>
          );
        })}
      </div>

      {/* Activation Review Section - Only show if not activated */}
      {!isActivated && intake.status === "ready_for_activation" && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-emerald-400">Ready for Activation</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                This lease is ready to become operational. Review the commercial terms before activating.
              </p>
              <div className="mt-4 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[var(--text-secondary)]">Commercial Terms complete</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[var(--text-secondary)]">Tenant selected</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[var(--text-secondary)]">Property & Unit assigned</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowActivationModal(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              Activate Lease
            </button>
          </div>
        </div>
      )}

      {/* Activated Banner */}
      {isActivated && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-emerald-400">Lease Activated</h3>
          <p className="text-sm text-[var(--text-muted)] mt-2 max-w-md mx-auto">
            This lease is now operational. Revenue operations have been initiated and the unit has been marked as occupied.
          </p>
          {intake.lease_id && (
            <p className="text-xs text-[var(--text-muted)] mt-3 font-mono">
              Lease ID: {intake.lease_id}
            </p>
          )}
          <button 
  onClick={() => router.push('/financials/revenue')}
  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors"
>
  Go to Revenue Operations
</button>
        </div>
      )}

      {/* Commercial Terms - Disabled when activated */}
      <div className={`grid grid-cols-2 gap-6 ${isActivated ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Applicant Details</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-muted)]">Company Name</label>
              <input value={intake.applicant_name || ""} onChange={(e) => updateField("applicant_name", e.target.value)} disabled={isActivated} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 disabled:opacity-50 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)]">Registration Number</label>
              <input value={intake.company_registration || ""} onChange={(e) => updateField("company_registration", e.target.value)} disabled={isActivated} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 disabled:opacity-50 disabled:cursor-not-allowed" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-muted)]">Contact Email</label>
                <input value={intake.contact_email || ""} onChange={(e) => updateField("contact_email", e.target.value)} disabled={isActivated} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Contact Phone</label>
                <input value={intake.contact_phone || ""} onChange={(e) => updateField("contact_phone", e.target.value)} disabled={isActivated} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Commercial Terms</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-muted)]">Monthly Rental (R)</label>
                <input type="number" value={intake.monthly_rental || ""} onChange={(e) => updateField("monthly_rental", parseFloat(e.target.value))} disabled={isActivated} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Deposit (R)</label>
                <input type="number" value={intake.deposit_amount || ""} onChange={(e) => updateField("deposit_amount", parseFloat(e.target.value))} disabled={isActivated} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-muted)]">Escalation (%)</label>
                <input type="number" value={intake.escalation_percent || ""} onChange={(e) => updateField("escalation_percent", parseFloat(e.target.value))} disabled={isActivated} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Term (months)</label>
                <input type="number" value={intake.lease_term_months || ""} onChange={(e) => updateField("lease_term_months", parseInt(e.target.value))} disabled={isActivated} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-muted)]">Start Date</label>
                <input type="date" value={intake.commencement_date || ""} onChange={(e) => updateField("commencement_date", e.target.value)} disabled={isActivated} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Parking Bays</label>
                <input type="number" value={intake.parking_bays || ""} onChange={(e) => updateField("parking_bays", parseInt(e.target.value))} disabled={isActivated} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes - Disabled when activated */}
      <div className={isActivated ? 'opacity-50 pointer-events-none' : ''}>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Negotiation Notes</h2>
        <textarea value={intake.negotiation_notes || ""} onChange={(e) => updateField("negotiation_notes", e.target.value)} disabled={isActivated} rows={3} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] resize-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="Notes about negotiations, special terms, or tenant requests..." />
      </div>

      {/* Activation Confirmation Modal */}
      {showActivationModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-3xl p-6 max-w-md w-full border border-[var(--border-default)] shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Confirm Activation</h3>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              This will:
            </p>
            <ul className="text-sm text-[var(--text-secondary)] mt-3 space-y-1.5">
              <li>• Create an operational lease</li>
              <li>• Generate billing rules</li>
              <li>• Update unit occupancy</li>
              <li>• Notify the tenant</li>
              <li>• Update portfolio reporting</li>
            </ul>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowActivationModal(false)}
                className="flex-1 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleActivate}
                disabled={activating}
                className="flex-1 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {activating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  "Confirm Activation"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
