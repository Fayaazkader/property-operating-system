'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import { InitialBillingModal } from '@/app/(protected)/tenants/components/InitialBillingModal';
import Link from 'next/link';
const ExecutionFieldEditor = dynamic(() => import('./ExecutionFieldEditor'), { ssr: false });

type Participant = {
  id: string;
  participant_type: string;
  name: string;
  email: string | null;
  status: string;
  signing_order: number;
  signed_at: string | null;
};

type Execution = {
  id: string;
  status: string;
  version: number;
};

type Version = {
  id: string;
  status: string;
  version: number;
};

type WorkspaceProps = {
  opportunityId: string;
  entityId: string;
};

const inputClass =
  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]';

export default function ExecutionWorkspace({
  opportunityId,
  entityId,
}: WorkspaceProps) {
  const [execution, setExecution] = useState<Execution | null>(null);
  const [version, setVersion] = useState<Version | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activation,setActivation]=useState<{leaseId:string;tenantId:string}|null>(null);
  const [billingOpen,setBillingOpen]=useState(false);
  const [prepared, setPrepared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [landlordEmail, setLandlordEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Your session has expired.');
      }

      const response = await fetch(
        `/api/leasing/opportunities/${opportunityId}/execution`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: 'no-store',
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'Unable to load execution status.',
        );
      }

      setExecution(result.execution ?? null);
      setActivation(result.activation ?? null);
      setVersion(result.version ?? null);
      setParticipants(result.participants ?? []);
      setPrepared(result.prepared === true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load execution status.',
      );
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body?: Record<string, string>) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Your session has expired.');
    }

    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body ?? {}),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'The operation could not be completed.');
    }

    return result;
  }

  async function run(
    action: () => Promise<string>,
  ) {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const message = await action();
      setNotice(message);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Operation failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  const tenant = participants.find(p => p.participant_type === 'tenant');
  const landlord = participants.find(p => p.participant_type === 'landlord');

  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Lease execution
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Governed agreement preparation, signatories and sequential signing.
        </p>
      </div>

      {loading && <p className="text-sm">Loading execution status...</p>}

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>
      )}

      {notice && (
        <p role="status" className="mb-3 text-sm text-emerald-400">{notice}</p>
      )}

      {!loading && !execution && (
        <p className="text-sm text-[var(--text-muted)]">
          No approved execution exists yet. Generate and approve the lease
          before nominating signatories.
        </p>
      )}

      {execution && (
        <div className="space-y-5">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Execution</p>
              <p className="font-medium">{execution.status}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Document</p>
              <p>{prepared ? 'PDF committed' : 'Preparation required'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Signing order</p>
              <p>Tenant → Landlord</p>
            </div>
          </div>

          {execution.status === 'under_review' && !prepared && (
            <button
              type="button"
              disabled={busy || !version}
              className={inputClass}
              onClick={() => void run(async () => {
                await post(`/api/execution/${execution.id}/prepare`);
                return 'Agreement PDF prepared and verified.';
              })}
            >
              Prepare agreement for signing
            </button>
          )}

          {execution.status === 'under_review' && prepared && participants.length === 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Nominate signatories</h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClass} placeholder="Tenant signatory name"
                  value={tenantName} onChange={e => setTenantName(e.target.value)} />
                <input className={inputClass} placeholder="Tenant email"
                  type="email" value={tenantEmail} onChange={e => setTenantEmail(e.target.value)} />
                <input className={inputClass} placeholder="Landlord signatory name"
                  value={landlordName} onChange={e => setLandlordName(e.target.value)} />
                <input className={inputClass} placeholder="Landlord email"
                  type="email" value={landlordEmail} onChange={e => setLandlordEmail(e.target.value)} />
              </div>

              <button
                type="button"
                disabled={busy || !tenantName.trim() || !tenantEmail.trim()
                  || !landlordName.trim() || !landlordEmail.trim()}
                className={inputClass}
                onClick={() => void run(async () => {
                  await post(`/api/execution/${execution.id}/signatories`, {
                    tenantName, tenantEmail, landlordName, landlordEmail,
                  });
                  return 'Signatories nominated and locked.';
                })}
              >
                Confirm and lock signatories
              </button>
            </div>
          )}

          {participants.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Signing progress</h3>
              {participants.map(participant => (
                <div key={participant.id}
                  className="flex justify-between gap-3 border-b border-[var(--border-default)] py-2 text-sm">
                  <div>
                    <p>{participant.name} ({participant.participant_type})</p>
                    <p className="text-xs text-[var(--text-muted)]">{participant.email}</p>
                  </div>
                  <p>{participant.signed_at ? 'Signed' : participant.status}</p>
                </div>
              ))}
            </div>
          )}

          {prepared && tenant && landlord && (
            <ExecutionFieldEditor key={`${execution.id}:${execution.status}`} executionId={execution.id} entityId={entityId}
              participants={participants} editable={execution.status === 'under_review'} onSaved={() => setNotice('Field placements saved.')} />
          )}

          {execution.status === 'under_review' && prepared &&
            tenant && landlord && (
              <button
                type="button"
                disabled={busy}
                className={inputClass}
                onClick={() => void run(async () => {
                  await post(`/api/execution/${execution.id}/ready`);
                  return 'Execution marked ready for signing.';
                })}
              >
                Confirm ready for signing
              </button>
            )}

          {version && tenant && !tenant.signed_at &&
            execution.status !== 'under_review' && (
              <button
                type="button"
                disabled={busy}
                className={inputClass}
                onClick={() => void run(async () => {
                  const result = await post(
                    `/api/execution/${execution.id}/invitations`,
                    {
                      participantId: tenant.id,
                      documentVersionId: version.id,
                    },
                  );

                  return `Tenant invitation delivery status: ${result.deliveryStatus}.`;
                })}
              >
                Create tenant signing invitation
              </button>
            )}

          {version && landlord && tenant?.signed_at &&
            !landlord.signed_at && (
              <button
                type="button"
                disabled={busy}
                className={inputClass}
                onClick={() => void run(async () => {
                  const result = await post(
                    `/api/execution/${execution.id}/invitations`,
                    {
                      participantId: landlord.id,
                      documentVersionId: version.id,
                    },
                  );

                  return `Landlord invitation delivery status: ${result.deliveryStatus}.`;
                })}
              >
                Create landlord signing invitation
              </button>
            )}



          {version && execution.status === 'partially_signed' && participants.length > 0 && participants.every(p => p.signed_at) && (
            <button type="button" disabled={busy} className={inputClass} onClick={() => void run(async () => {
              await post(`/api/execution/${execution.id}/finalise`, { entityId, documentVersionId: version.id });
              return 'Executed agreement and certificate verified and committed.';
            })}>Recover final executed documents</button>
          )}

          {version && execution.status==='executed' && <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
            <h3 className="font-semibold">Ready for operational activation</h3>
            <p className="text-sm text-[var(--text-secondary)]">Create the tenant, assign the unit and prepare billing rules from the executed agreement. Initial charges remain subject to review and approval.</p>
            <button type="button" className="af-control" disabled={busy} onClick={()=>void run(async()=>{
              const result=await post(`/api/execution/${execution.id}/activate`,{entityId,documentVersionId:version.id});
              setActivation({leaseId:result.lease_id,tenantId:result.tenant_id});setBillingOpen(true);
              return 'Lease activated. Review the initial charges before posting.';
            })}>Activate executed lease</button>
          </div>}
          {activation && execution.status==='activated' && <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
            <h3 className="font-semibold">Operational lease</h3>
            <div className="flex flex-wrap gap-3"><Link className="af-control" href={`/leases/${activation.leaseId}`}>Open lease</Link>
              <Link className="af-control" href={`/tenants/${activation.tenantId}`}>Open tenant</Link>
              <button type="button" className="af-control" onClick={()=>setBillingOpen(true)}>Review initial charges</button></div>
          </div>}
          {billingOpen && activation && <InitialBillingModal leaseId={activation.leaseId} entityId={entityId}
            onClose={()=>setBillingOpen(false)} onSkip={()=>setBillingOpen(false)}
            onApprove={()=>{setBillingOpen(false);setNotice('Commencement invoice issued and tenant ledger posted. Deposit funds remain unreceived.');}}/>}

          {version && ['executed','activated'].includes(execution.status) && (
            <div className="flex gap-3">{(['signed_pdf','execution_certificate'] as const).map(kind => <button key={kind} type="button" disabled={busy} className={inputClass}
              onClick={() => void run(async () => {
                const {data:{session}}=await supabase.auth.getSession();
                if(!session)throw new Error('Your session has expired.');
                const response=await fetch(`/api/execution/${execution.id}/artifacts?entityId=${entityId}&documentVersionId=${version.id}&artifactType=${kind}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
                if(!response.ok)throw new Error('Executed document unavailable.');
                const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=`${kind}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
                return 'Executed document downloaded.';
              })}>{kind==='signed_pdf'?'Download executed agreement':'Download certificate'}</button>)}</div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="text-xs text-[var(--text-muted)] underline"
          >
            Refresh execution status
          </button>
        </div>
      )}

      <p className="mt-5 text-xs text-[var(--text-muted)]">
        Public signing remains controlled by server-side feature flags.
        Creating an invitation does not confirm email delivery.
      </p>
    </section>
  );
}
