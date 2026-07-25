'use client';

import { useState, useRef } from 'react';
import { utilityImportService } from '@/lib/revenue/services/utility-import-service';

interface ImportUtilitiesModalProps {
  entityId: string;
  periodId?: string;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportUtilitiesModal({ entityId, periodId, onClose, onImported }: ImportUtilitiesModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const text = await file.text();
      const res = await utilityImportService.import({
        entityId,
        periodId,
        csvText: text,
      });
      setResult(res);
      onImported();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    }
    setLoading(false);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-8 max-w-xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-light text-white">Import Utilities</h2>
              <p className="text-xs text-zinc-500 mt-1">Upload a CSV file with tenant utility readings</p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                  <p className="text-2xl font-light text-emerald-400">{result.imported}</p>
                  <p className="text-[10px] text-emerald-500 uppercase tracking-wider mt-1">Imported</p>
                </div>
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-center">
                  <p className="text-2xl font-light text-amber-400">{result.skipped}</p>
                  <p className="text-[10px] text-amber-500 uppercase tracking-wider mt-1">Skipped</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-white/[0.06] overflow-hidden max-h-40 overflow-y-auto">
                  <div className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.06]">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Details</p>
                  </div>
                  {result.errors.map((err: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.03] text-[11px]">
                      <span className="text-zinc-600 w-8">Row {err.row}</span>
                      <span className="text-red-400">{err.reason}</span>
                      <span className="text-zinc-600 truncate">{err.data}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={onClose} className="w-full rounded-lg bg-white py-2.5 text-xs font-medium text-black hover:bg-gray-100 transition-all">Done</button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-white/[0.08] rounded-xl p-8 text-center cursor-pointer hover:border-white/20 transition-all"
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                  {file ? (
                    <div>
                      <p className="text-sm text-white font-light">{file.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-zinc-400 font-light">Drop CSV file here or click to browse</p>
                      <p className="text-xs text-zinc-600 mt-1">Columns: tenant, type, amount, description</p>
                    </div>
                  )}
                </div>

                {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3"><p className="text-xs text-red-400">{error}</p></div>}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={onClose} className="flex-1 rounded-lg border border-white/[0.08] py-2.5 text-xs font-medium text-white hover:border-white/20 transition-all">Cancel</button>
                <button onClick={handleImport} disabled={!file || loading} className="flex-1 rounded-lg bg-white py-2.5 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
                  {loading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
