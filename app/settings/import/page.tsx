'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { PageHeader } from '@/app/components/layout/PageHeader';
import { 
  SOURCE_SYSTEMS, 
  SYSTEM_PRESETS, 
  detectSystem, 
  getDbColumnForHeader,
  getDbTargetForTarget 
} from '@/lib/column-mapping';

type Target = 'properties' | 'tenants' | 'leases';
type Step = 'upload' | 'map' | 'confirm';

const TARGETS: { value: Target; label: string }[] = [
  { value: 'properties', label: 'Properties' },
  { value: 'tenants', label: 'Tenants' },
  { value: 'leases', label: 'Leases' },
];

const REQUIRED: Record<Target, string[]> = {
  properties: ['property_name'],
  tenants: ['tenant_name'],
  leases: ['property_name', 'tenant_name', 'monthly_rental', 'commencement_date'],
};

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [target, setTarget] = useState<Target>('properties');
  const [sourceSystem, setSourceSystem] = useState<string>('other');
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ total: 0, succeeded: 0, failed: 0 });
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [detectedSystem, setDetectedSystem] = useState<string | null>(null);

  const handleFileUpload = useCallback((file: File) => {
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvString = event.target?.result as string;
      if (!csvString) {
        alert('Failed to read file.');
        return;
      }

      Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];
          if (!data || data.length === 0 || Object.keys(data[0] || {}).length === 0) {
            alert('File is empty or has no headers.');
            return;
          }
          const cols = Object.keys(data[0]);
          setHeaders(cols);
          setRawData(data);

          const detected = detectSystem(cols);
          setDetectedSystem(detected);
          if (detected && detected !== 'other') {
            setSourceSystem(detected);
          }

          const autoMap: Record<string, string> = {};
          const unmapped: string[] = [];
          const dbColumns = getDbTargetForTarget(target);

          cols.forEach((col) => {
            const dbCol = getDbColumnForHeader(col);
            if (dbCol && dbColumns.includes(dbCol)) {
              autoMap[col] = dbCol;
            } else {
              unmapped.push(col);
            }
          });

          setColumnMap(autoMap);
          setUnmappedHeaders(unmapped);
          setStep('map');
        },
        error: (err: any) => {
          console.error('CSV Parse Error:', err);
          alert(`Failed to parse CSV: ${err.message || 'Unknown error'}`);
        },
      });
    };
    reader.onerror = () => {
      alert('Failed to read file.');
    };
    reader.readAsText(file);
  }, [target]);

  const updateMapping = (header: string, dbColumn: string) => {
    setColumnMap((prev) => ({ ...prev, [header]: dbColumn }));
    if (dbColumn) {
      setUnmappedHeaders((prev) => prev.filter(h => h !== header));
    } else {
      setUnmappedHeaders((prev) => [...prev, header]);
    }
  };

  const applySystemPreset = (system: string) => {
    const preset = SYSTEM_PRESETS[system];
    if (!preset) return;

    const newMap: Record<string, string> = {};
    const dbColumns = getDbTargetForTarget(target);
    
    headers.forEach((header) => {
      const mappedColumn = preset[header];
      if (mappedColumn && dbColumns.includes(mappedColumn)) {
        newMap[header] = mappedColumn;
      } else {
        const auto = getDbColumnForHeader(header);
        if (auto && dbColumns.includes(auto)) {
          newMap[header] = auto;
        }
      }
    });

    setColumnMap(newMap);
    const unmapped = headers.filter(h => !newMap[h]);
    setUnmappedHeaders(unmapped);
    setSourceSystem(system);
  };

  const isMappingValid = () => {
    const required = REQUIRED[target];
    const mappedValues = Object.values(columnMap);
    return required.every((req) => mappedValues.includes(req));
  };

  const handleImport = async () => {
    setIsImporting(true);
    setErrorLog([]);

    const mappedRows = rawData.map((row) => {
      const mapped: any = {};
      Object.entries(columnMap).forEach(([header, dbCol]) => {
        if (dbCol && row[header] !== undefined && row[header] !== '') {
          mapped[dbCol] = row[header];
        }
      });
      return mapped;
    }).filter((row) => Object.keys(row).length > 0);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          rows: mappedRows,
        }),
      });

      const result = await response.json();
      setProgress({
        total: result.total || 0,
        succeeded: result.succeeded || 0,
        failed: result.failed || 0,
      });
      if (result.errors) setErrorLog(result.errors);
      setStep('confirm');
    } catch (error: any) {
      alert(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setRawData([]);
    setHeaders([]);
    setColumnMap({});
    setUnmappedHeaders([]);
    setProgress({ total: 0, succeeded: 0, failed: 0 });
    setErrorLog([]);
    setFileName('');
    setDetectedSystem(null);
    setSourceSystem('other');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 pt-8 pb-12">
      {/* Header with Download Template button on the far right */}
      <div className="flex items-start justify-between">
        <div>
          <PageHeader 
            title="Data Migration Centre" 
            subtitle="Upload your data and AssetFlow will map it automatically." 
          />
          {detectedSystem && (
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Detected: {detectedSystem.toUpperCase()}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            const url = `/api/import/template?target=${target}`;
            window.open(url, '_blank');
          }}
          className="mt-1 px-4 py-2 rounded-2xl text-sm border border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <span>📄</span>
          Download Template
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
        <span className={step === 'upload' ? 'text-[var(--text-primary)]' : ''}>1. Upload</span>
        <span className="w-8 h-px bg-[var(--border-default)]" />
        <span className={step === 'map' ? 'text-[var(--text-primary)]' : ''}>2. Review</span>
        <span className="w-8 h-px bg-[var(--border-default)]" />
        <span className={step === 'confirm' ? 'text-[var(--text-primary)]' : ''}>3. Confirm</span>
      </div>

      {step === 'upload' && (
  <div className="space-y-6">
    {/* Target Selector */}
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1.5 uppercase tracking-[0.2em]">
        What are you importing?
      </label>
      <div className="flex gap-2 flex-wrap">
        {TARGETS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTarget(t.value)}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
              target === t.value
                ? 'bg-white text-black'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>

    {/* ==== TEMPLATES SECTION — ADD THIS ==== */}
    <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/40 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            📄 Need a template?
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Download a CSV template with the correct columns for <span className="font-medium text-[var(--text-primary)]">{target}</span>
          </p>
        </div>
        <button
          onClick={() => {
            const url = `/api/import/template?target=${target}`;
            window.open(url, '_blank');
          }}
          className="px-5 py-2.5 rounded-2xl text-sm font-medium bg-[var(--text-primary)] text-black hover:opacity-90 transition flex items-center gap-2 whitespace-nowrap"
        >
          <span>⬇️</span>
          Download Template
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-3 py-1 rounded-full">
          {target === 'properties' ? 'name, address, city...' : 
           target === 'tenants' ? 'name, code, email...' : 
           'lease_number, property_name, tenant_name...'}
        </span>
        <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-3 py-1 rounded-full">
          .csv format
        </span>
      </div>
    </div>

    {/* Source System Selector */}
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1.5 uppercase tracking-[0.2em]">
        Source System
      </label>
      <select
        value={sourceSystem}
        onChange={(e) => setSourceSystem(e.target.value)}
        className="w-full max-w-xs rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]"
      >
        {SOURCE_SYSTEMS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      {detectedSystem && detectedSystem !== 'other' && (
        <p className="text-xs text-[var(--text-muted)] mt-1.5">
          💡 Detected: {detectedSystem.toUpperCase()} — we'll auto-map your columns
        </p>
      )}
    </div>

    {/* Upload Area */}
    <div className="border-2 border-dashed border-[var(--border-default)] rounded-3xl p-12 text-center hover:border-[var(--border-hover)] transition-colors">
      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        className="hidden"
        id="csv-upload"
      />
      <label htmlFor="csv-upload" className="cursor-pointer block">
        <div className="text-4xl mb-3">📄</div>
        <p className="text-[var(--text-primary)] font-medium">Drop your CSV here, or click to browse</p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Supports .csv only. First row must contain headers.
        </p>
      </label>
    </div>
  </div>
)}

      {step === 'map' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 text-sm">
            <p className="text-[var(--text-muted)]">
              File: <span className="text-[var(--text-primary)] font-mono">{fileName}</span> &nbsp;|&nbsp; 
              Rows: <span className="text-[var(--text-primary)] font-mono">{rawData.length}</span> &nbsp;|&nbsp;
              Target: <span className="text-[var(--text-primary)] font-mono">{target}</span>
            </p>
            {sourceSystem !== 'other' && (
              <p className="text-[var(--text-muted)] mt-1">
                Source: <span className="text-[var(--text-primary)] font-mono uppercase">{sourceSystem}</span>
                <button
                  onClick={() => applySystemPreset(sourceSystem)}
                  className="ml-3 text-xs text-[var(--accent)] hover:underline"
                >
                  Apply preset
                </button>
              </p>
            )}
          </div>

          {unmappedHeaders.length > 0 && (
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs font-medium text-amber-300 uppercase tracking-[0.2em] mb-1">
                {unmappedHeaders.length} Column{unmappedHeaders.length > 1 ? 's' : ''} Need Review
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {unmappedHeaders.join(', ')}
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)]">
                  <th className="text-left py-3 pr-4 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-normal">CSV Header</th>
                  <th className="text-left py-3 pr-4 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-normal">Map to DB Column</th>
                  <th className="text-left py-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-normal">Sample Value</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header) => {
                  const sample = rawData.length > 0 ? rawData[0][header] : '';
                  const isRequired = REQUIRED[target].includes(columnMap[header] || '');
                  const isMapped = !!columnMap[header];
                  const dbColumns = getDbTargetForTarget(target);
                  
                  return (
                    <tr key={header} className={`border-b border-[var(--border-default)]/50 ${!isMapped ? 'bg-amber-500/5' : ''}`}>
                      <td className="py-3 pr-4 font-mono text-[var(--text-primary)]">
                        {header}
                        {isRequired && <span className="ml-2 text-[var(--accent)] text-xs">*</span>}
                        {!isMapped && <span className="ml-2 text-amber-400 text-xs">⚠</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          value={columnMap[header] || ''}
                          onChange={(e) => updateMapping(header, e.target.value)}
                          className="w-full max-w-[220px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]"
                        >
                          <option value="">— Ignore —</option>
                          {dbColumns.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 text-[var(--text-muted)] truncate max-w-[150px]">
                        {String(sample).slice(0, 30)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={reset}
              className="rounded-2xl border border-[var(--border-default)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition"
            >
              ← Back
            </button>
            <button
              onClick={handleImport}
              disabled={!isMappingValid() || isImporting}
              className={`rounded-2xl px-8 py-3 text-sm font-semibold transition ${
                isMappingValid() && !isImporting
                  ? 'bg-[var(--text-primary)] text-black hover:opacity-90'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed'
              }`}
            >
              {isImporting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importing...
                </span>
              ) : (
                'Import →'
              )}
            </button>
          </div>
          {!isMappingValid() && (
            <p className="text-xs text-amber-400 mt-2">
              Please map all required fields (*) before importing.
            </p>
          )}
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-6">
          <div className={`rounded-3xl border p-6 ${
            progress.failed === 0 && progress.succeeded > 0
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : progress.failed > 0 && progress.succeeded > 0
              ? 'border-amber-500/20 bg-amber-500/5'
              : 'border-red-500/20 bg-red-500/5'
          }`}>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-2xl">
                {progress.failed === 0 && progress.succeeded > 0 && '✅'}
                {progress.failed > 0 && progress.succeeded > 0 && '⚠️'}
                {progress.succeeded === 0 && progress.failed > 0 && '❌'}
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">
                  {progress.succeeded} succeeded · {progress.failed} failed
                </p>
                <p className="text-[var(--text-muted)] text-xs">
                  Total rows processed: {progress.total}
                </p>
              </div>
            </div>
          </div>

          {errorLog.length > 0 && (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-4 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-red-300 uppercase tracking-[0.2em] mb-2">Errors</p>
              {errorLog.map((err, i) => (
                <p key={i} className="text-xs text-[var(--text-muted)] font-mono py-0.5">
                  • {err}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button
              onClick={reset}
              className="rounded-2xl border border-[var(--border-default)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition"
            >
              ← Import Another
            </button>
            <button
              onClick={() => router.push('/')}
              className="rounded-2xl bg-[var(--text-primary)] text-black px-8 py-3 text-sm font-semibold hover:opacity-90 transition"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}