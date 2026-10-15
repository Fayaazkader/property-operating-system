'use client';

import { useEffect, useState } from 'react';
import type { ExecutionField } from '@/lib/execution/field-manifest';

type Session = {
  participantName: string;
  participantType: string;
  expiresAt: string;
  manifestSha256: string | null;
  fields: ExecutionField[];
};

export default function SigningClient({ token }: { token: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [signature, setSignature] = useState('');
  const [initials, setInitials] = useState('');
  const [completedFields, setCompletedFields] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function load() {
      try {
        const response = await fetch('/api/execution/signing-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Invitation unavailable');

        const details = await response.json() as Session;
        if (!active) return;
        setSession(details);

        const documentResponse = await fetch('/api/execution/signing-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          cache: 'no-store',
        });
        if (!documentResponse.ok) throw new Error('Document unavailable');

        const blob = await documentResponse.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch {
        if (active) setMessage('Secure signing is currently unavailable.');
      }
    }

    void load();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function requestCode() {
    setBusy(true);
    setMessage('');
    try {
      const data = await post('/api/execution/verification/request', { token });
      setVerificationId(data.verificationId);
      setMessage('Verification code sent to your registered email address.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Verification unavailable');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setMessage('');
    try {
      const data = await post('/api/execution/verification/verify', {
        token, verificationId, code,
      });
      setVerified(data.verified === true);
      setMessage(data.verified ? 'Email verified.' : 'Incorrect or expired code.');
    } catch {
      setMessage('Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!verified || !consent || !signature.trim() || !session || completedFields.length !== session.fields.length ||
        (session.fields.some(f => f.type === 'initial') && !initials.trim())) return;

    setBusy(true);
    setMessage('');

    try {
      function typedImage(value: string) {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 180;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Signature capture unavailable');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#111111';
      context.font = '48px cursive';
      context.textBaseline = 'middle';

      const fullName = value.trim();

      if (context.measureText(fullName).width > 740) {
        throw new Error('Signature is too long');
      }

      context.fillText(fullName, 30, 90);

      return canvas.toDataURL('image/png');
      }
      const dataUrl = typedImage(signature);

      await post('/api/execution/signing-submit', {
        token,
        verificationId,
        signatureDataUrl: dataUrl,
        initialsDataUrl: session.fields.some(f => f.type === 'initial') ? typedImage(initials) : undefined,
        manifestSha256: session.manifestSha256,
        completedFieldIds: completedFields,
        signatureMethod: 'typed',
        consentAccepted: true,
        authorityDeclaration: 'I confirm that I am authorised to sign this agreement.',
      });

      setComplete(true);
      setPdfUrl(null);
      setMessage('Your signature has been securely recorded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Signing failed.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadCompleted(artifactType: 'signed_pdf' | 'execution_certificate') {
    setBusy(true);
    try {
      const response=await fetch('/api/execution/completed-document',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token,verificationId,artifactType}),cache:'no-store'});
      if(!response.ok)throw new Error('The completed documents are not yet available. Your signature remains recorded.');
      const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=`${artifactType}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error){setMessage(error instanceof Error?error.message:'Document unavailable.');}
    finally{setBusy(false);}
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">AssetFlow Secure Signing</h1>

      {complete ? (
        <section className="space-y-3">
          <p role="status">{message}</p>
          <p>Completed documents become available after all signatories have signed.</p>
          <button disabled={busy} onClick={() => void downloadCompleted('signed_pdf')} className="border rounded px-3 py-2">Download executed agreement</button>
          <button disabled={busy} onClick={() => void downloadCompleted('execution_certificate')} className="border rounded px-3 py-2">Download certificate</button>
        </section>
      ) : (
        <>
          {session && <p>Signing as {session.participantName}</p>}

          {pdfUrl && (
            <iframe
              title="Agreement for signature"
              src={pdfUrl}
              className="w-full h-[65vh] border rounded"
            />
          )}

          {!verified && session && pdfUrl && (
            <section className="space-y-3">
              <h2 className="font-semibold">Verify your identity</h2>
              <button disabled={busy} onClick={requestCode} className="border rounded px-4 py-2">
                Send email verification code
              </button>

              {verificationId && (
                <div className="flex gap-2">
                  <input
                    aria-label="Six-digit verification code"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    maxLength={6}
                    inputMode="numeric"
                    className="border rounded px-3 py-2"
                  />
                  <button disabled={busy || code.length !== 6} onClick={verifyCode} className="border rounded px-4 py-2">
                    Verify
                  </button>
                </div>
              )}
            </section>
          )}

          {verified && pdfUrl && (
            <section className="space-y-4">
              <h2 className="font-semibold">Sign the agreement</h2>
              <input
                aria-label="Type your full name as your signature"
                value={signature}
                onChange={e => setSignature(e.target.value)}
                placeholder="Type your full name"
                className="w-full border rounded px-3 py-2"
              />

              {session?.fields.some(f => f.type === 'initial') && <input
                aria-label="Type your initials" value={initials} onChange={e => setInitials(e.target.value)}
                maxLength={20} placeholder="Your initials" className="w-full border rounded px-3 py-2" />}
              <fieldset className="space-y-2">
                <legend className="font-semibold">Confirm each required field</legend>
                {session?.fields.map((field, index) => <label key={field.id} className="flex items-start gap-2">
                  <input type="checkbox" checked={completedFields.includes(field.id)}
                    onChange={e => setCompletedFields(previous => e.target.checked ? [...previous, field.id] : previous.filter(id => id !== field.id))} />
                  <span>{index + 1}. Page {field.page}: {field.type === 'date' ? 'Record my signing date (UTC)' : `Apply my ${field.type === 'initial' ? 'initials' : 'signature'}`}</span>
                </label>)}
              </fieldset>

              <label className="flex items-start gap-2">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
                <span>I have reviewed the agreement and consent to sign it electronically. I confirm that I am authorised to sign.</span>
              </label>

              <button
                disabled={busy || !consent || !signature.trim() || !session || completedFields.length !== session.fields.length ||
                  (session.fields.some(f => f.type === 'initial') && !initials.trim())}
                onClick={sign}
                className="border rounded px-5 py-3 font-semibold"
              >
                Sign agreement
              </button>
            </section>
          )}

          {message && <p role="status">{message}</p>}
        </>
      )}
    </main>
  );
}
