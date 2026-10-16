'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { parseExecutionFields, type ExecutionField } from '@/lib/execution/field-manifest';

type Participant = { id: string; name: string; participant_type: string };
type Manifest = { documentVersionId: string; pdfSha256: string; pageCount: number;
  fields: ExecutionField[]; revision: number; status: string };
const input = 'rounded border border-[var(--border-default)] bg-[var(--bg-primary)] p-2 text-sm';

export default function ExecutionFieldEditor({ executionId, entityId, participants, editable, onSaved }: {
  executionId: string; entityId: string; participants: Participant[]; editable: boolean; onSaved: () => void;
}) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [fields, setFields] = useState<ExecutionField[]>([]);
  const [page, setPage] = useState(1);
  const [participantId, setParticipantId] = useState(participants[0]?.id ?? '');
  const [type, setType] = useState<ExecutionField['type']>('signature');
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [display, setDisplay] = useState({ width: 600, height: 800 });
  const [rendered, setRendered] = useState(false);
  const [generation, setGeneration] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sequence = useRef(0);

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired.');
    return { Authorization: `Bearer ${session.access_token}` };
  }
  const endpoint = `/api/execution/${executionId}/fields?entityId=${encodeURIComponent(entityId)}`;
  useEffect(() => {
    let active = true;
    setManifest(null); setPdfBytes(null); setError('');
    void (async () => {
      try {
        const headers = await authHeaders();
        const [metadata, document] = await Promise.all([
          fetch(endpoint, { headers, cache: 'no-store' }),
          fetch(`${endpoint}&pdf=true`, { headers, cache: 'no-store' }),
        ]);
        if (!metadata.ok || !document.ok) throw new Error('Signing field preparation unavailable.');
        const data = await metadata.json() as Manifest;
        const bytes = await document.arrayBuffer();
        if (active) { setManifest(data); setFields(data.fields); setPdfBytes(bytes); setPage(1); }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : 'Unable to load agreement.'); }
    })();
    return () => { active = false; };
  }, [endpoint,generation]);

  useEffect(() => {
    const current = ++sequence.current;
    let cancel: (() => void) | undefined;
    setRendered(false);
    if (!pdfBytes) return;
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf-workers/execution.worker.min.mjs';
        const task = pdfjs.getDocument({ data: new Uint8Array(pdfBytes.slice(0)) });
        cancel = () => { void task.destroy(); };
        const document = await task.promise;
        const pdfPage = await document.getPage(page);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const scaled = pdfPage.getViewport({ scale: 760 / viewport.width });
        if (current !== sequence.current || !canvas.current) { await task.destroy(); return; }
        const target = canvas.current;
        target.width = scaled.width; target.height = scaled.height;
        setDisplay({ width: scaled.width, height: scaled.height });
        const context = target.getContext('2d');
        if (!context) throw new Error('Document preview unavailable.');
        await pdfPage.render({ canvas: target, canvasContext: context, viewport: scaled }).promise;
        if (current === sequence.current) setRendered(true);
      } catch { if (current === sequence.current) setError('Could not render this PDF page.'); }
    })();
    return () => { ++sequence.current; cancel?.(); };
  }, [pdfBytes, page]);

  const canEdit = editable && manifest?.status === 'draft' && !busy;
  function update(id: string, key: keyof ExecutionField, value: number | string) {
    setFields(previous => previous.map(field => field.id === id ? { ...field, [key]: value } : field));
    setNotice('Unsaved field changes');
  }
  async function save() {
    if (!manifest) return;
    setBusy(true); setError(''); setNotice('');
    try {
      parseExecutionFields(fields, manifest.pageCount, participants.map(p => p.id));
      const response = await fetch(endpoint, { method: 'POST', headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, documentVersionId: manifest.documentVersionId, pdfSha256: manifest.pdfSha256,
          expectedRevision: manifest.revision, fields }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save fields.');
      setManifest({ ...manifest, revision: result.revision, fields });
      setNotice('Field placements saved. Confirm readiness to lock them.'); onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save fields.'); }
    finally { setBusy(false); }
  }
  const field = fields.find(item => item.id === selected);
  return <section className="space-y-3" aria-label="Agreement signing fields">
    <h3 className="font-semibold">Place signing fields</h3>
    <button type="button" disabled={busy} className={input} onClick={() => { setNotice(''); setGeneration(g => g+1); }}>Reload saved fields</button>
    <p className="text-sm">Choose a signatory and field, then click the agreement. Adjust the rectangle below. All placed fields must be completed.</p>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {manifest && <>
      <div className="flex flex-wrap gap-2">
        <label>Page <input aria-label="PDF page" className={input} type="number" min={1} max={manifest.pageCount} value={page}
          onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= manifest.pageCount) setPage(n); }} /></label>
        <select aria-label="Signatory" className={input} value={participantId} onChange={e => setParticipantId(e.target.value)}>
          {participants.map(p => <option key={p.id} value={p.id}>{p.name} ({p.participant_type})</option>)}
        </select>
        <select aria-label="Field type" className={input} value={type} onChange={e => setType(e.target.value as ExecutionField['type'])}>
          <option value="signature">Signature</option><option value="initial">Initials</option><option value="date">Signing date</option>
        </select>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded border bg-white">
        <div className="relative" style={{ width: display.width, height: display.height }}>
          <canvas ref={canvas} aria-label={`Agreement page ${page}`} className="absolute inset-0" />
          <button type="button" aria-label="Place selected signing field on agreement" disabled={!canEdit || !rendered}
            className="absolute inset-0 h-full w-full" onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const width = type === 'signature' ? .25 : .16, height = .065;
              const x = Math.min(1 - width, Math.max(0, (e.clientX - rect.left) / rect.width));
              const y = Math.min(1 - height, Math.max(0, (e.clientY - rect.top) / rect.height));
              const id = crypto.randomUUID();
              setFields([...fields, { id, participantId, type, page, x, y, width, height }]); setSelected(id); setNotice('Unsaved field changes');
            }} />
          {fields.filter(f => f.page === page).map(f => <button key={f.id} type="button" onClick={() => setSelected(f.id)}
            aria-label={`Select ${f.type} for ${participants.find(p => p.id === f.participantId)?.name}`}
            className={`absolute border-2 text-left text-xs text-black ${selected === f.id ? 'border-blue-600 bg-blue-100/80' : 'border-amber-600 bg-amber-100/80'}`}
            style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.width * 100}%`, height: `${f.height * 100}%` }}>
            {participants.find(p => p.id === f.participantId)?.name}: {f.type}
          </button>)}
        </div>
      </div>
      <label>Field <select aria-label="Select placed field" className={input} value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">Select a field</option>{fields.map((f,i) => <option key={f.id} value={f.id}>{i + 1}. Page {f.page}: {participants.find(p => p.id === f.participantId)?.name} — {f.type}</option>)}
      </select></label>
      {field && <div className="flex flex-wrap gap-2">
        {(['x','y','width','height'] as const).map(key => <label key={key}>{key} (%) <input className={input} aria-label={`${key} percent`} type="number"
          min={0} max={100} step={.01} disabled={!canEdit} value={Number((field[key] * 100).toFixed(4))}
          onChange={e => update(field.id, key, Number(e.target.value) / 100)} /></label>)}
        <button type="button" className={input} disabled={!canEdit} onClick={() => { setFields(fields.filter(f => f.id !== field.id)); setSelected(''); setNotice('Unsaved field changes'); }}>Remove field</button>
      </div>}
      <button type="button" className={input} disabled={!canEdit} onClick={() => void save()}>Save field placements</button>
      <p className="text-xs">Revision {manifest.revision} · {manifest.status} · {fields.length} fields</p>
    </>}
  </section>;
}
