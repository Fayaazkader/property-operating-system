// lib/revenue/services/utility-import-service.ts
// Governed utility import — validates, resolves, deduplicates, bulk inserts

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';

interface ImportRow {
  tenant: string;
  type: string;
  amount: string;
  description: string;
  gl_code?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string; data: string }>;
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Proper CSV parsing — handles quoted fields with commas
  // Handles quoted fields with commas. Does not handle escaped quotes or embedded newlines (RFC 4180 edge cases).
  // Production: consider Papaparse or a dedicated CSV library.
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += char;
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z_]/g, '_'));
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const row: any = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row as ImportRow;
  });
}

export const utilityImportService = {
  async import(params: {
    entityId: string;
    periodId?: string;
    csvText: string;
  }): Promise<ImportResult> {
    const rows = parseCSV(params.csvText);
    if (rows.length === 0) {
      return { imported: 0, skipped: 0, errors: [{ row: 0, reason: 'No valid rows found', data: '' }] };
    }

    // 1. Load all tenants once
    const { data: allTenants } = await supabase
      .from('tenants')
      .select('id, tenant_name')
      .eq('entity_id', params.entityId);

    const tenantMap = new Map<string, string>();
    for (const t of (allTenants || [])) {
      tenantMap.set(t.tenant_name.toLowerCase(), t.id);
    }

    // 2. Check existing charges for duplicate detection
    const { data: existingCharges } = await supabase
      .from('manual_charges')
      .select('tenant_id, description, amount_excl, period_id')
      .eq('entity_id', params.entityId)
      .eq('period_id', params.periodId || '');

    const existingSet = new Set<string>();
  const csvSet = new Set<string>();
    for (const c of (existingCharges || [])) {
      existingSet.add(`${c.tenant_id}|${c.description}|${c.amount_excl}|${c.period_id}`);
    }

    // 3. Process rows
    const charges: any[] = [];
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tenantId = tenantMap.get(row.tenant?.toLowerCase() || '');

      if (!tenantId) {
        result.skipped++;
        result.errors.push({ row: i + 1, reason: 'Unknown tenant', data: row.tenant });
        continue;
      }

      const amount = parseFloat(row.amount || '0');
      if (isNaN(amount) || amount <= 0) {
        result.skipped++;
        result.errors.push({ row: i + 1, reason: 'Invalid amount', data: row.amount });
        continue;
      }

      const description = row.description || `Utilities - ${row.type || 'consumption'}`;
      const duplicateKey = `${tenantId}|${description}|${amount}|${params.periodId || ''}`;

      if (csvSet.has(duplicateKey)) {
        result.skipped++;
        result.errors.push({ row: i + 1, reason: "Duplicate in CSV", data: description });
        continue;
      }
      csvSet.add(duplicateKey);
      if (existingSet.has(duplicateKey)) {
        result.skipped++;
        result.errors.push({ row: i + 1, reason: 'Duplicate charge', data: description });
        continue;
      }

      const vatRate = 15;
      const vatAmount = Math.round(amount * (vatRate / 100) * 100) / 100;

      charges.push({
        id: crypto.randomUUID(),
        entity_id: params.entityId,
        tenant_id: tenantId,
        description,
        amount_excl: amount,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        amount_incl: amount + vatAmount,
        gl_code: row.gl_code || '4200',
        period_id: params.periodId || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    }

    // 4. Bulk insert
    // Note: Partial failure — if any row violates a constraint, entire batch may fail.
    // Production: use row-level error handling or insert one-by-one with error collection.
    if (charges.length > 0) {
      const { error } = await supabase.from('manual_charges').insert(charges);
      if (error) {
        result.errors.push({ row: 0, reason: `Database error: ${error.message}`, data: '' });
      } else {
        result.imported = charges.length;
      }
    }

    // 5. Publish event only on success
    if (charges.length > 0 && result.imported > 0) {
      await publish('utilities.import.completed', {
        correlationId: crypto.randomUUID(),
        source: 'utility-import-service',
        version: '1.0',
        payload: {
          entityId: params.entityId,
          periodId: params.periodId,
          imported: result.imported,
          skipped: result.skipped,
        },
      });
    }

    return result;
  }
};
