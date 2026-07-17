'use client';

import type { DocumentModel } from '../types';

interface RenderProps {
  model: DocumentModel;
  onAction?: (action: string) => void;
}

export function DocumentRenderer({ model, onAction }: RenderProps) {
  if (!model?.metadata) return null;

  const isInvoice = model.metadata.document_type === 'invoice';
  const m = model;

  return (
    <div className="bg-white text-neutral-800 max-w-2xl mx-auto font-sans print:shadow-none print:rounded-none shadow-2xl">
      
      {/* STATUS BADGE */}
      {m.metadata.status !== 'issued' && (
        <div className="bg-neutral-100 px-8 py-2 text-center border-b border-neutral-200">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500">{m.metadata.status}</span>
        </div>
      )}

      <div className="p-10 space-y-8">
        
        {/* ═══════════ HEADER ═══════════ */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            {m.branding.logo_url && <img src={m.branding.logo_url} alt="Logo" className="h-10 mb-3" />}
            <h2 className="text-base font-bold text-neutral-900">{m.company.name}</h2>
            {m.company.registration_number && <p className="text-[11px] text-neutral-500">Reg: {m.company.registration_number}</p>}
            {m.company.vat_number && <p className="text-[11px] text-neutral-500">VAT: {m.company.vat_number}</p>}
            {m.company.physical_address && <p className="text-[11px] text-neutral-500 mt-1">{m.company.physical_address}</p>}
            {m.company.postal_address && <p className="text-[11px] text-neutral-400">Postal: {m.company.postal_address}</p>}
            {m.company.telephone && <p className="text-[11px] text-neutral-500">Tel: {m.company.telephone}</p>}
            {m.company.email && <p className="text-[11px] text-neutral-500">{m.company.email}</p>}
            {m.company.website && <p className="text-[11px] text-neutral-400">{m.company.website}</p>}
          </div>
          <div className="text-right space-y-1">
            <h1 className="text-lg font-bold text-neutral-900 tracking-tight">
              {isInvoice ? 'TAX INVOICE' : 'STATEMENT OF ACCOUNT'}
            </h1>
            <p className="text-[10px] text-neutral-500">{m.metadata.document_number}</p>
            <div className="text-[11px] text-neutral-600 space-y-0.5 mt-2">
              <p>Issue: {m.metadata.issue_date}</p>
              {m.metadata.due_date && <p>Due: {m.metadata.due_date}</p>}
              {m.metadata.billing_period && <p>Period: {m.metadata.billing_period}</p>}
              <p>Currency: {m.metadata.currency || 'ZAR'}</p>
              <p>Status: {m.metadata.status}</p>
            </div>
          </div>
        </div>

        {/* ═══════════ CUSTOMER ═══════════ */}
        <div className="border-t border-b border-neutral-200 py-4 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Bill To</p>
            <p className="text-sm font-bold text-neutral-800">{m.customer.name}</p>
            {m.customer.code && <p className="text-[11px] text-neutral-500">Code: {m.customer.code}</p>}
            {m.customer.account_number && <p className="text-[11px] text-neutral-500">Account: {m.customer.account_number}</p>}
          </div>
          <div>
            {m.customer.property_name && <p className="text-sm text-neutral-700">{m.customer.property_name}</p>}
            {m.customer.building && <p className="text-[11px] text-neutral-500">{m.customer.building}</p>}
            {m.customer.unit && <p className="text-[11px] text-neutral-500">{m.customer.unit}</p>}
            {m.customer.lease_ref && <p className="text-[11px] text-neutral-500">Lease: {m.customer.lease_ref}</p>}
            {m.customer.entity && <p className="text-[11px] text-neutral-500">Entity: {m.customer.entity}</p>}
          </div>
        </div>

        {/* ═══════════ HEADER MESSAGE ═══════════ */}
        {m.header_message && (
          <div className="bg-neutral-50 border border-neutral-100 rounded p-3">
            <p className="text-xs text-neutral-600">{m.header_message}</p>
          </div>
        )}

        {/* ═══════════ ACCOUNT SUMMARY (Statement only) ═══════════ */}
        {!isInvoice && m.account_summary && (
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Opening', value: m.account_summary.opening_balance },
              { label: 'Charges', value: m.account_summary.current_charges },
              { label: 'Payments', value: m.account_summary.payments_received, color: 'text-emerald-600' },
              { label: 'Credits', value: m.account_summary.credit_notes, color: 'text-red-500' },
              { label: 'Due', value: m.account_summary.amount_due, bold: true },
            ].map((kpi, i) => (
              <div key={i} className="bg-neutral-50 rounded p-3 text-center">
                <p className="text-[9px] uppercase tracking-wider text-neutral-400">{kpi.label}</p>
                <p className={`text-sm font-semibold mt-1 tabular-nums ${kpi.color || 'text-neutral-800'} ${kpi.bold ? 'text-base' : ''}`}>
                  R{kpi.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════ SECTIONS ═══════════ */}
        {m.sections.map((section, i) => (
          <div key={i}>
            {section.title && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">{section.title}</p>
            )}
            <SectionRenderer section={section} />
          </div>
        ))}

        {/* ═══════════ AGING (Statement only) ═══════════ */}
        {!isInvoice && m.aging && m.aging.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">Aging Summary</p>
            <div className="grid grid-cols-5 gap-2">
              {m.aging.map((bucket, i) => (
                <div key={i} className={`text-center py-2 rounded ${bucket.amount > 0 ? 'bg-red-50' : 'bg-neutral-50'}`}>
                  <p className="text-[9px] text-neutral-500">{bucket.label}</p>
                  <p className={`text-xs font-semibold tabular-nums ${bucket.amount > 0 ? 'text-red-600' : 'text-neutral-400'}`}>
                    R{bucket.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ TOTALS ═══════════ */}
        <div className="space-y-2 pt-4 border-t-2 border-neutral-900">
          {isInvoice ? (
            <>
              <TotalsRow label="Subtotal" value={m.totals.subtotal} />
              <TotalsRow label="VAT @ 15%" value={m.totals.vat_total} />
              {m.totals.payments_received > 0 && <TotalsRow label="Payments Received" value={-m.totals.payments_received} color="text-emerald-600" />}
              {m.totals.credits_applied > 0 && <TotalsRow label="Credits Applied" value={-m.totals.credits_applied} color="text-red-500" />}
            </>
          ) : (
            <>
              {m.totals.opening_balance !== undefined && <TotalsRow label="Opening Balance" value={m.totals.opening_balance} />}
              {m.totals.closing_balance !== undefined && <TotalsRow label="Closing Balance" value={m.totals.closing_balance} />}
            </>
          )}
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
              {isInvoice ? 'Total Due' : 'Amount Due'}
            </span>
            <span className="text-xl font-bold text-neutral-900 tabular-nums">
              R{m.totals.balance_due.toLocaleString()}
            </span>
          </div>
        </div>

        {/* ═══════════ DEPOSIT ═══════════ */}
        {m.deposit_held !== undefined && m.deposit_held > 0 && (
          <div className="flex justify-between text-sm py-2 border-t border-neutral-200">
            <span className="text-neutral-500">Deposit Held</span>
            <span className="text-neutral-700 tabular-nums">R{m.deposit_held.toLocaleString()}</span>
          </div>
        )}

        {/* ═══════════ BANKING ═══════════ */}
        {m.banking && (
          <div className="border-t border-neutral-200 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Banking Details</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-neutral-600">
              <p>Bank: {m.banking.bank_name}</p>
              {m.banking.branch_name && <p>Branch: {m.banking.branch_name}</p>}
              {m.banking.branch_code && <p>Branch Code: {m.banking.branch_code}</p>}
              <p>Account: {m.banking.account_number}</p>
              {m.banking.account_type && <p>Type: {m.banking.account_type}</p>}
              <p>Reference: {m.banking.reference}</p>
              {m.banking.swift && <p>SWIFT: {m.banking.swift}</p>}
            </div>
            {m.banking.qr_code && (
              <div className="mt-3 flex justify-end">
                <img src={m.banking.qr_code} alt="QR Payment" className="h-20 w-20" />
              </div>
            )}
          </div>
        )}

        {/* ═══════════ PAYMENT TERMS ═══════════ */}
        {m.payment_terms && (
          <div className="border-t border-neutral-200 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Payment Terms</p>
            <p className="text-xs text-neutral-600 whitespace-pre-line">{m.payment_terms}</p>
          </div>
        )}

        {/* ═══════════ CONTACTS ═══════════ */}
        {m.contacts && (
          <div className="border-t border-neutral-200 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Contacts</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-neutral-600">
              {m.contacts.accounts_email && <p>Accounts: {m.contacts.accounts_email}</p>}
              {m.contacts.accounts_phone && <p>Tel: {m.contacts.accounts_phone}</p>}
              {m.contacts.property_manager && <p>Manager: {m.contacts.property_manager}</p>}
              {m.contacts.maintenance && <p>Maintenance: {m.contacts.maintenance}</p>}
            </div>
          </div>
        )}

        {/* ═══════════ FOOTER ═══════════ */}
        <div className="border-t border-neutral-200 pt-4 space-y-2 text-center">
          {m.footer_message && <p className="text-[10px] text-neutral-400">{m.footer_message}</p>}
          {m.metadata.prepared_by && <p className="text-[9px] text-neutral-400">Prepared by: {m.metadata.prepared_by}</p>}
          <p className="text-[9px] text-neutral-400">Generated: {m.metadata.generated_at} · v{m.metadata.version}</p>
          {m.branding.legal_disclaimer && <p className="text-[8px] text-neutral-300 max-w-md mx-auto">{m.branding.legal_disclaimer}</p>}
          {m.branding.show_powered_by && (
            <p className="text-[9px] text-neutral-300">Generated by AssetFlow — Commercial Property Operating System</p>
          )}
        </div>
      </div>

      {/* ═══════════ ACTIONS ═══════════ */}
      {onAction && (
        <div className="border-t border-neutral-200 px-10 py-4 flex gap-2 justify-end bg-neutral-50 rounded-b-lg print:hidden flex-wrap">
          {['Preview PDF', 'Download PDF', 'Email', 'WhatsApp', 'Print', 'Issue', 'Regenerate', 'Archive'].map(action => (
            <button
              key={action}
              onClick={() => onAction(action.toLowerCase().replace(/\s/g, '-'))}
              className="text-[11px] px-3 py-1.5 rounded border border-neutral-300 text-neutral-600 hover:bg-white transition-all"
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TotalsRow({ label, value, color = 'text-neutral-800' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className={`tabular-nums ${color}`}>R{Math.abs(value).toLocaleString()}</span>
    </div>
  );
}

function SectionRenderer({ section }: { section: any }) {
  switch (section.type) {
    case 'charges':
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-300">
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Code</th>
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">GL</th>
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Description</th>
              <th className="text-center py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-12">Qty</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Rate</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-16">VAT%</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {(section.data || []).map((line: any, i: number) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2.5 text-xs text-neutral-400">{line.charge_code || '—'}</td>
                <td className="py-2.5 text-xs text-neutral-400">{line.gl_code || '—'}</td>
                <td className="py-2.5 text-sm text-neutral-800">{line.description}</td>
                <td className="py-2.5 text-xs text-neutral-600 text-center">{line.quantity || 1}</td>
                <td className="py-2.5 text-xs text-neutral-600 text-right">{line.rate ? `R${line.rate.toLocaleString()}` : '—'}</td>
                <td className="py-2.5 text-xs text-neutral-600 text-right">{line.vat_rate}%</td>
                <td className="py-2.5 text-sm text-neutral-800 text-right font-medium tabular-nums">R{line.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case 'ledger':
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-300">
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Date</th>
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Reference</th>
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Description</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-28">Debit</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-28">Credit</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-28">Balance</th>
            </tr>
          </thead>
          <tbody>
            {(section.data || []).map((line: any, i: number) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2.5 text-xs text-neutral-500">{line.date}</td>
                <td className="py-2.5 text-xs text-neutral-400">{line.reference || line.document_number || '—'}</td>
                <td className="py-2.5 text-sm text-neutral-800">{line.description}</td>
                <td className="py-2.5 text-sm text-neutral-800 text-right tabular-nums">{line.debit > 0 ? `R${line.debit.toLocaleString()}` : ''}</td>
                <td className="py-2.5 text-sm text-neutral-800 text-right tabular-nums">{line.credit > 0 ? `R${line.credit.toLocaleString()}` : ''}</td>
                <td className="py-2.5 text-sm font-medium text-neutral-800 text-right tabular-nums">R{line.balance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case 'credit_notes':
      return (
        <div className="space-y-1">
          {(section.data || []).map((cn: any, i: number) => (
            <div key={i} className="flex justify-between py-2 border-b border-red-100 text-sm bg-red-50/30 px-3 rounded">
              <div>
                <span className="text-red-600 font-medium">{cn.reference}</span>
                <span className="text-red-500 text-xs ml-2">{cn.reason}</span>
              </div>
              <span className="text-red-600 font-medium tabular-nums">-R{cn.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );

    case 'payments':
      return (
        <div className="space-y-1">
          {(section.data || []).map((p: any, i: number) => (
            <div key={i} className="flex justify-between py-2 border-b border-emerald-100 text-sm bg-emerald-50/30 px-3 rounded">
              <div>
                <span className="text-emerald-600 font-medium">{p.reference}</span>
                <span className="text-emerald-500 text-xs ml-2">{p.method} · {p.date}</span>
              </div>
              <span className="text-emerald-600 font-medium tabular-nums">-R{p.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );

    default:
      return <p className="text-sm text-neutral-500 italic">{section.title || section.type}</p>;
  }
}
