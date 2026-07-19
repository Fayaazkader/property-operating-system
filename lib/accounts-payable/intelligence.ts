// lib/accounts-payable/intelligence.ts
// AP Intelligence — Suggestions, patterns, warnings

import { supabase } from '@/lib/supabase';

export interface APWarning {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  invoiceId?: string;
  supplierId?: string;
}

export interface CodingSuggestion {
  supplierId: string;
  glCode: string;
  propertyId?: string;
  vatCode: string;
  confidence: number;
  basedOn: number;
}

export const apIntelligence = {
  async getWarnings(entityId: string): Promise<APWarning[]> {
    const warnings: APWarning[] = [];

    // Duplicate invoices — manual detection since Supabase JS doesn't support .group()
    const { data: allInvoices } = await supabase.from('supplier_invoices_new').select('supplier_id, invoice_number').eq('entity_id', entityId);
    const seen = new Map<string, number>();
    for (const inv of (allInvoices || [])) {
      const key = `${inv.supplier_id}-${inv.invoice_number}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    for (const [key, count] of seen) {
      if (count > 1) {
        const [supplierId, invoiceNumber] = key.split('-');
        warnings.push({ type: 'duplicate', severity: 'high', message: `Duplicate invoice: ${invoiceNumber}`, supplierId });
      }
    }

    // Overdue invoices
    const today = new Date().toISOString().split('T')[0];
    const { data: overdue } = await supabase.from('supplier_invoices_new').select('id, invoice_number, supplier_id').eq('entity_id', entityId).in('lifecycle_status', ['posted', 'posting_queue']).lt('due_date', today);
    (overdue || []).forEach((inv: any) => {
      warnings.push({ type: 'overdue', severity: 'high', message: `Invoice overdue: ${inv.invoice_number}`, invoiceId: inv.id, supplierId: inv.supplier_id });
    });

    // Inactive suppliers with invoices
    const { data: inactiveSuppliers } = await supabase.from('suppliers').select('id, supplier_name').eq('entity_id', entityId).eq('is_active', false);
    for (const s of (inactiveSuppliers || [])) {
      const { count } = await supabase.from('supplier_invoices_new').select('*', { count: 'exact', head: true }).eq('supplier_id', s.id).in('lifecycle_status', ['posted', 'posting_queue']);
      if ((count || 0) > 0) {
        warnings.push({ type: 'inactive_supplier', severity: 'medium', message: `Inactive supplier has posted invoices: ${s.supplier_name}`, supplierId: s.id });
      }
    }

    // Credit available but not applied
    const { data: credits } = await supabase.from('supplier_credit_notes').select('supplier_id, amount').eq('entity_id', entityId).eq('credit_status', 'available');
    for (const c of (credits || [])) {
      if (c.amount > 0) {
        warnings.push({ type: 'credit_available', severity: 'low', message: `Credit available: R${c.amount.toLocaleString()}`, supplierId: c.supplier_id });
      }
    }

    return warnings;
  },

  async getCodingSuggestions(supplierId: string): Promise<CodingSuggestion | null> {
    const { data: recentInvoices } = await supabase.from('supplier_invoices_new').select('id').eq('supplier_id', supplierId).order('created_at', { ascending: false }).limit(12);
    if (!recentInvoices?.length) return null;

    const invoiceIds = recentInvoices.map(i => i.id);
    const { data: lines } = await supabase.from('supplier_invoice_lines').select('gl_code, property_id, vat_code').in('invoice_id', invoiceIds);
    if (!lines?.length) return null;

    const glCounts = new Map<string, number>();
    const propertyCounts = new Map<string, number>();
    const vatCounts = new Map<string, number>();
    for (const l of lines) {
      glCounts.set(l.gl_code, (glCounts.get(l.gl_code) || 0) + 1);
      if (l.property_id) propertyCounts.set(l.property_id, (propertyCounts.get(l.property_id) || 0) + 1);
      vatCounts.set(l.vat_code, (vatCounts.get(l.vat_code) || 0) + 1);
    }

    const topGL = [...glCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topProperty = [...propertyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topVat = [...vatCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    if (!topGL) return null;

    return {
      supplierId,
      glCode: topGL[0],
      propertyId: topProperty?.[0],
      vatCode: topVat?.[0] || 'standard',
      confidence: Math.round((topGL[1] / lines.length) * 100),
      basedOn: lines.length,
    };
  }
};
