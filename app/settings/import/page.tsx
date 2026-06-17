'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { PageHeader } from '@/app/components/layout/PageHeader';
import { supabase } from '@/lib/supabase';
import { 
  SOURCE_SYSTEMS, 
  SYSTEM_PRESETS, 
  detectSystem, 
  getDbColumnForHeader,
  getDbTargetForTarget,
  saveUserMapping,
  fuzzyMatch   
} from '@/lib/column-mapping';
import { CustomDropdown } from '@/components/ui';



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

type ProgressState = {
  total: number;
  succeeded: number;
  failed: number;
  duplicates?: {
    count: number;
    items: any[];
    errors: string[];
    message: string;
  };
  errorRows?: any[];
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
  const [progress, setProgress] = useState<ProgressState>({ 
    total: 0, 
    succeeded: 0, 
    failed: 0 
  });
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [detectedSystem, setDetectedSystem] = useState<string | null>(null);
  const [preCheckData, setPreCheckData] = useState<{
    duplicateIndices: number[];
    duplicateCount: number;
    existingValues: string[];
    message: string;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [entities, setEntities] = useState<any[]>([]);
const [selectedEntity, setSelectedEntity] = useState('');
  

 // ===== PRE-CHECK FUNCTION =====
const handlePreCheck = useCallback(async (dataToCheck: any[]) => {
  console.log('=== PRECHECK CALLED ===');
  console.log('rawData length:', dataToCheck.length);
  
  if (dataToCheck.length === 0) {
    console.log('No data, skipping precheck');
    return;
  }
  
  setIsChecking(true);
  try {
    console.log('Calling /api/import/precheck with target:', target);
    const response = await fetch('/api/import/precheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target,
        rows: dataToCheck,
        entityId: selectedEntity,
      }),
    });
    
    console.log('Response status:', response.status);
    
    const result = await response.json();
    console.log('Precheck result:', result);
    console.log('Duplicate indices:', result.duplicateIndices);
    console.log('Duplicate count:', result.duplicateCount);
    
    setPreCheckData(result);
  } catch (error: any) {
    console.error('Precheck error:', error);
  } finally {
    setIsChecking(false);
  }
}, [target]);
// Load user's entities
useEffect(() => {
  async function loadEntities() {
    const { data: userEntities } = await supabase
      .from('user_entities')
      .select('entity_id, entities!inner(entity_name, entity_code)');
    
    if (userEntities && userEntities.length > 0) {
      const entityList = userEntities.map((ue: any) => ({
        id: ue.entity_id,
        name: ue.entities?.entity_name || 'Unknown',
        code: ue.entities?.entity_code || '',
      }));
      setEntities(entityList);
      setSelectedEntity(entityList[0].id);
    }
  }
  loadEntities();
}, []);
// ===== FILE UPLOAD FUNCTION =====
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
  const dbCol = getDbColumnForHeader(col, target);  // Pass target for fuzzy matching
  if (dbCol && dbColumns.includes(dbCol)) {
    autoMap[col] = dbCol;
  } else {
    unmapped.push(col);
  }
});

        setColumnMap(autoMap);
        setUnmappedHeaders(unmapped);
        setStep('map');
        
        // DELAY AND PASS DATA DIRECTLY
        setTimeout(() => {
          handlePreCheck(data);
        }, 100);
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
}, [target, handlePreCheck]);

  const updateMapping = (header: string, dbColumn: string) => {
  setColumnMap((prev) => ({ ...prev, [header]: dbColumn }));
  
  // Save user mapping if they mapped it to a real column
  if (dbColumn) {
    saveUserMapping(header, dbColumn);
  }
  
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
        duplicates: result.duplicates || undefined,
        errorRows: result.errorRows || undefined,
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
    setPreCheckData(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 pt-8 pb-12">
      {/* Header */}
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

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
        <span className={step === 'upload' ? 'text-[var(--text-primary)]' : ''}>1. Upload</span>
        <span className="w-8 h-px bg-[var(--border-default)]" />
        <span className={step === 'map' ? 'text-[var(--text-primary)]' : ''}>2. Review</span>
        <span className="w-8 h-px bg-[var(--border-default)]" />
        <span className={step === 'confirm' ? 'text-[var(--text-primary)]' : ''}>3. Confirm</span>
      </div>

      {/* ==================== STEP 1: UPLOAD ==================== */}
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

          {/* Templates Section */}
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
            <CustomDropdown
              value={sourceSystem}
              onChange={setSourceSystem}
              options={SOURCE_SYSTEMS}
              placeholder="Select source system..."
              className="w-full max-w-xs"
            />
            {detectedSystem && detectedSystem !== 'other' && (
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                💡 Detected: {detectedSystem.toUpperCase()} — we'll auto-map your columns
              </p>
            )}
          </div>
{/* Source System Selector */}
<div>
  <label className="block text-xs text-[var(--text-muted)] mb-1.5 uppercase tracking-[0.2em]">
    Source System
  </label>
  <CustomDropdown
    value={sourceSystem}
    onChange={setSourceSystem}
    options={SOURCE_SYSTEMS}
    placeholder="Select source system..."
    className="w-full max-w-xs"
  />
  {detectedSystem && detectedSystem !== 'other' && (
    <p className="text-xs text-[var(--text-muted)] mt-1.5">
      💡 Detected: {detectedSystem.toUpperCase()} — we'll auto-map your columns
    </p>
  )}
</div>

{/* ==== ADD ENTITY SELECTOR HERE ==== */}
<div>
  <label className="block text-xs text-[var(--text-muted)] mb-1.5 uppercase tracking-[0.2em]">
    Entity
  </label>
  {entities.length === 0 ? (
    <p className="text-sm text-[var(--text-muted)]">Loading entities...</p>
  ) : (
    <CustomDropdown
      value={selectedEntity}
      onChange={setSelectedEntity}
      options={entities.map(e => ({ 
        value: e.id, 
        label: `${e.name} (${e.code})` 
      }))}
      placeholder="Select entity..."
      className="w-full max-w-xs"
    />
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

      {/* ==================== STEP 2: REVIEW ==================== */}
      {step === 'map' && (
        <div className="space-y-6">
          {/* File Info */}
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

          {/* Unmapped Headers Warning */}
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

          {/* Row Preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                👀 Preview Data
                {isChecking && <span className="ml-2 text-xs text-[var(--text-muted)]">Checking duplicates...</span>}
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                Showing {Math.min(5, rawData.length)} of {rawData.length} rows
              </span>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[var(--border-default)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-secondary)]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-[0.2em]">#</th>
                    {headers.slice(0, 6).map((header) => {
                      const dbCol = columnMap[header];
                      return (
                        <th key={header} className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-[0.2em]">
                          <div className="flex flex-col">
                            <span>{dbCol || header}</span>
                            {dbCol && dbCol !== header && (
                              <span className="text-[10px] font-normal text-[var(--text-muted)]/60">
                                ← {header}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    {headers.length > 6 && (
                      <th className="px-4 py-2.5 text-left text-xs text-[var(--text-muted)]">+{headers.length - 6} more</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rawData.slice(0, 5).map((row, rowIndex) => {
                    const isDuplicate = preCheckData?.duplicateIndices?.includes(rowIndex) || false;
                    
                    return (
                      <tr key={rowIndex} className={`border-t border-[var(--border-default)] ${isDuplicate ? 'bg-amber-500/5' : ''}`}>
                        <td className="px-4 py-2.5 text-xs text-[var(--text-muted)] font-mono">
                          {rowIndex + 1}
                          {isDuplicate && <span className="ml-1 text-amber-400 text-[10px]">⚠️</span>}
                        </td>
                        {headers.slice(0, 6).map((header) => (
                          <td key={header} className="px-4 py-2.5 text-xs text-[var(--text-primary)] font-mono max-w-[150px] truncate">
                            {row[header] || <span className="text-[var(--text-muted)]/40">—</span>}
                          </td>
                        ))}
                        {headers.length > 6 && (
                          <td className="px-4 py-2.5 text-xs text-[var(--text-muted)]">…</td>
                        )}
                      </tr>
                    );
                  })}
                  {rawData.length > 5 && (
                    <tr className="border-t border-[var(--border-default)]">
                      <td className="px-4 py-2.5 text-xs text-[var(--text-muted)] font-mono text-center" colSpan={Math.min(7, headers.length + 1)}>
                        + {rawData.length - 5} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-500/5 border border-amber-500/20"></span>
                ⚠️ Already exists in database (will be skipped on import)
              </span>
              {preCheckData && preCheckData.duplicateCount > 0 && (
                <span className="text-amber-400 font-medium">
                  {preCheckData.duplicateCount} duplicate{preCheckData.duplicateCount > 1 ? 's' : ''} found
                </span>
              )}
              {preCheckData && preCheckData.duplicateCount === 0 && (
                <span className="text-emerald-400 font-medium">✅ No duplicates found</span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              🔍 Preview shows how your data will be mapped before import
            </p>
          </div>

          {/* Column Mapping Table */}
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
  {(() => {
    const dbColumns = getDbTargetForTarget(target);
    const fuzzySuggestion = columnMap[header] ? null : fuzzyMatch(header, dbColumns);
    
    return (
      <CustomDropdown
        value={columnMap[header] || ''}
        onChange={(value) => updateMapping(header, value)}
        options={[
          { value: '', label: '— Ignore —' },
          ...dbColumns.map(col => ({ 
            value: col, 
            label: fuzzySuggestion?.bestMatch === col ? `${col} (suggested)` : col 
          }))
        ]}
        placeholder={fuzzySuggestion?.bestMatch ? `Suggested: ${fuzzySuggestion.bestMatch}` : "Map to column..."}
        className="w-full max-w-[220px]"
      />
    );
  })()}
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

          {/* Action Buttons */}
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

      {/* ==================== STEP 3: CONFIRM ==================== */}
      {step === 'confirm' && (
        <div className="space-y-6">
          {/* Results */}
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
                {progress.duplicates && progress.duplicates.count > 0 && (
                  <p className="text-xs text-amber-400 mt-1">
                    ⚠️ {progress.duplicates.count} duplicate(s) found and skipped
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Error CSV Download */}
          {progress.errorRows && progress.errorRows.length > 0 && (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-300">
                    ❌ {progress.errorRows.length} rows failed
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Download the failed rows to see what went wrong
                  </p>
                </div>
                <button
                  onClick={() => {
                    const headers = Object.keys(progress.errorRows?.[0] || {});
                    const csvContent = [
                      headers.join(','),
                      ...(progress.errorRows || []).map((row: any) => 
                        headers.map(h => {
                          const val = row[h] || '';
                          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
                        }).join(',')
                      )
                    ].join('\n');
                    
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `failed_rows_${target}_${new Date().toISOString().slice(0,10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 rounded-2xl text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition whitespace-nowrap"
                >
                  ⬇️ Download Error CSV
                </button>
              </div>
            </div>
          )}

          {/* Errors list */}
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