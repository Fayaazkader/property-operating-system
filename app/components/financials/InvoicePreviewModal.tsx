'use client';

import { DocumentRenderer } from '@/lib/documents/renderers/react-renderer';

interface InvoicePreviewModalProps {
  data: any;
  onClose: () => void;
}

export default function InvoicePreviewModal({ data, onClose }: InvoicePreviewModalProps) {
  const postedLines = data.posted_lines || [];
  
  // Use actual vat_amount from charges — 0 is valid, don't override
  const chargeLines = postedLines
    .filter((l: any) => l.debit > 0)
    .map((l: any) => {
      const hasVat = l.vat_amount !== undefined && l.vat_amount !== null;
      return {
        description: l.description,
        amount: l.debit,
        vat_amount: hasVat ? l.vat_amount : Math.round(l.debit * 0.15),
        total: l.debit + (hasVat ? l.vat_amount : Math.round(l.debit * 0.15)),
      };
    });

  const subtotal = chargeLines.reduce((s: number, l: any) => s + l.amount, 0);
  const vatTotal = chargeLines.reduce((s: number, l: any) => s + l.vat_amount, 0);
  const grandTotal = subtotal + vatTotal;

  const model = {
    metadata: {
      document_type: 'invoice' as const,
      document_number: `INV-${Date.now()}`,
      issue_date: data.statement_date || new Date().toISOString().split('T')[0],
      due_date: 'Upon receipt',
      billing_period: data.statement_date,
      currency: 'ZAR',
      version: data.version || 1,
      status: data.status || 'issued',
      generated_at: data.generated_at || new Date().toISOString(),
    },
    company: {
      name: data.company_name || 'Sandton Office Holdings',
      registration_number: '2021/123456/07',
      vat_number: data.company_vat_number || '4567891234',
      physical_address: data.company_address || '1 Alice Lane, Sandton, 2196',
      telephone: '+27 11 234 5678',
      email: 'accounts@sandtonoffice.co.za',
    },
    customer: {
      name: data.tenant_name || 'Tenant',
      property_name: data.property_name || '',
      lease_ref: data.lease_ref || '',
    },
    banking: {
      bank_name: 'First National Bank',
      branch_code: '250655',
      account_number: '62772361589',
      reference: data.lease_ref || '',
    },
    branding: { watermark_enabled: false, show_powered_by: true },
    footer_message: data.footer_message || 'Payment due within 7 days.',
    sections: [{
      type: 'charges',
      title: 'Charges',
      data: chargeLines,
    }],
    totals: {
      subtotal,
      vat_total: vatTotal,
      total: grandTotal,
      payments_received: 0,
      credits_applied: 0,
      balance_due: data.closing_balance || grandTotal,
    },
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
        <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
          <div className="flex justify-end mb-2">
            <button onClick={onClose} className="text-white/60 hover:text-white text-sm">Close ✕</button>
          </div>
          <DocumentRenderer model={model} onAction={(a: string) => { if (a === 'print') window.print(); }} />
        </div>
      </div>
    </>
  );
}
