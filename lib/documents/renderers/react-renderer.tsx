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
            {m.company.telephone && <p className="text-[11px] text-neutral-500">Tel: {m.company.telephone}</p>}
            {m.company.email && <p className="text-[11px] text-neutral-500">{m.company.email}</p>}
          </div>
          <div className="text-right space-y-1">
            <h1 className="text-lg font-bold text-neutral-900 tracking-tight">
              {isInvoice ? 'TAX INVOICE' : 'STATEMENT OF ACCOUNT'}
            </h1>
            <p className="text-[10px] text-neutral-500">{m.metadata.document_number}</p>
            <div className="text-[11px] text-neutral-600 space-y-0.5 mt-2">
              <p>{isInvoice ? 'Issue' : 'Statement'} Date: {m.metadata.issue_date}</p>
              {isInvoice && m.metadata.due_date && <p>Due Date: {m.metadata.due_date}</p>}
              {isInvoice && m.metadata.billing_period && <p>Billing Period: {m.metadata.billing_period}</p>}
              {!isInvoice && <p>Period: {m.metadata.billing_period || m.metadata.issue_date}</p>}
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
            {m.customer.lease_ref && <p className="text-[11px] text-neutral-500">Lease: {m.customer.lease_ref}</p>}
          </div>
          <div>
            {m.customer.property_name && <p className="text-sm text-neutral-700">{m.customer.property_name}</p>}
            {m.customer.building && <p className="text-[11px] text-neutral-500">{m.customer.building}</p>}
            {m.customer.unit && <p className="text-[11px] text-neutral-500">{m.customer.unit}</p>}
            {m.customer.entity && <p className="text-[11px] text-neutral-500">Entity: {m.customer.entity}</p>}
          </div>
        </div>

        {/* ═══════════ HEADER MESSAGE ═══════════ */}
        {m.header_message && (
          <div className="bg-neutral-50 border border-neutral-100 rounded p-3">
            <p className="text-xs text-neutral-600">{m.header_message}</p>
          </div>
        )}

        {/* ═══════════ STATEMENT: ACCOUNT SUMMARY ═══════════ */}
        {!isInvoice && m.account_summary && (
          <div className="border-2 border-neutral-900 rounded p-5 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-900 text-center">Account Summary</p>
            <div className="space-y-2">
              <SummaryRow label="Opening Balance" value={m.account_summary.opening_balance} />
              <SummaryRow label="Charges Raised" value={m.account_summary.current_charges} />
              {m.account_summary.credit_notes > 0 && <SummaryRow label="Credit Notes" value={-m.account_summary.credit_notes} color="text-red-600" />}
              {m.account_summary.payments_received > 0 && <SummaryRow label="Payments Received" value={-m.account_summary.payments_received} color="text-emerald-600" />}
              {m.account_summary.interest > 0 && <SummaryRow label="Interest" value={m.account_summary.interest} />}
              <div className="border-t border-neutral-300 pt-2" />
              <SummaryRow label="Closing Balance" value={m.account_summary.closing_balance} bold />
            </div>
          </div>
        )}

        {/* ═══════════ INVOICE: CHARGES ═══════════ */}
        {isInvoice && m.sections.map((section, i) => (
          <div key={i}>
            {section.title && <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">{section.title}</p>}
            <SectionRenderer section={section} />
          </div>
        ))}

        {/* ═══════════ INVOICE: TOTALS ═══════════ */}
        {isInvoice && (
          <div className="space-y-2 pt-4 border-t-2 border-neutral-900">
            <TotalsRow label="Subtotal" value={m.totals.subtotal} />
            <TotalsRow label="VAT" value={m.totals.vat_total} />
            {m.totals.payments_received > 0 && <TotalsRow label="Payments Received" value={-m.totals.payments_received} color="text-emerald-600" />}
            {m.totals.credits_applied > 0 && <TotalsRow label="Credits Applied" value={-m.totals.credits_applied} color="text-red-600" />}
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Total Due</span>
              <span className="text-xl font-bold text-neutral-900 tabular-nums">R{m.totals.balance_due.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* ═══════════ STATEMENT: LEDGER ═══════════ */}
        {!isInvoice && m.sections.filter(s => s.type === 'ledger').map((section, i) => (
          <div key={i}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">{section.title}</p>
            <SectionRenderer section={section} />
          </div>
        ))}

        {/* ═══════════ STATEMENT: AGING ═══════════ */}
        {!isInvoice && m.aging && m.aging.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">Current Aging</p>
            <div className="grid grid-cols-5 gap-2">
              {m.aging.map((bucket, i) => (
                <div key={i} className={`text-center py-2 rounded ${bucket.amount > 0 ? 'bg-red-50' : 'bg-neutral-50'}`}>
                  <p className="text-[9px] text-neutral-500">{bucket.label}</p>
                  <p className={`text-xs font-semibold tabular-nums ${bucket.amount > 0 ? 'text-red-600' : 'text-neutral-400'}`}>R{bucket.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ STATEMENT: PROJECTED ═══════════ */}
        {!isInvoice && m.sections.filter(s => s.type === 'projected').map((section, i) => (
          <div key={i} className="border border-dashed border-neutral-300 rounded p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">{section.title || 'Projected Charges'} <span className="text-neutral-400 font-normal">(Estimates — Not Posted)</span></p>
            {(section.data || []).map((charge: any, j: number) => (
              <div key={j} className="flex justify-between py-1 text-xs">
                <span className="text-neutral-500">{charge.description}</span>
                <span className="text-neutral-500 tabular-nums">{charge.amount > 0 ? `R${charge.amount.toLocaleString()}` : 'TBD'}</span>
              </div>
            ))}
          </div>
        ))}

        {/* ═══════════ DEPOSIT ═══════════ */}
        {m.deposit_held !== undefined && m.deposit_held > 0 && (
          <div className="flex justify-between text-sm py-2 border-t border-neutral-200">
            <span className="text-neutral-500">Deposit Held</span>
            <span className="text-neutral-700 tabular-nums">R{m.deposit_held.toLocaleString()}</span>
          </div>
        )}

        {/* ═══════════ INVOICE: BANKING ═══════════ */}
        {isInvoice && m.banking && (
          <div className="border-t border-neutral-200 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Payment Details</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-neutral-600">
              <p>Bank: {m.banking.bank_name}</p>
              {m.banking.branch_code && <p>Branch Code: {m.banking.branch_code}</p>}
              <p>Account: {m.banking.account_number}</p>
              <p>Reference: {m.banking.reference}</p>
            </div>
          </div>
        )}

        {/* ═══════════ INVOICE: PAYMENT TERMS ═══════════ */}
        {isInvoice && m.payment_terms && (
          <div className="border-t border-neutral-200 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Payment Terms</p>
            <p className="text-xs text-neutral-600 whitespace-pre-line">{m.payment_terms}</p>
          </div>
        )}

        {/* ═══════════ STATEMENT: CONTACTS ═══════════ */}
        {!isInvoice && m.contacts && (
          <div className="border-t border-neutral-200 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Account Queries</p>
            <div className="text-xs text-neutral-600 space-y-0.5">
              {m.contacts.accounts_email && <p>Accounts: {m.contacts.accounts_email}</p>}
              {m.contacts.accounts_phone && <p>Tel: {m.contacts.accounts_phone}</p>}
              {m.contacts.property_manager && <p>Property Manager: {m.contacts.property_manager}</p>}
            </div>
          </div>
        )}

        {/* ═══════════ FOOTER ═══════════ */}
        <div className="border-t border-neutral-200 pt-4 space-y-2 text-center">
          {m.footer_message && <p className="text-[10px] text-neutral-400">{m.footer_message}</p>}
          {m.branding.show_powered_by && (
            <p className="text-[9px] text-neutral-300">Generated by AssetFlow — Commercial Property Operating System</p>
          )}
        </div>
      </div>

      {/* ═══════════ ACTIONS ═══════════ */}
      {onAction && (
        <div className="border-t border-neutral-200 px-10 py-4 flex gap-2 justify-end bg-neutral-50 rounded-b-lg print:hidden flex-wrap">
          {['Preview PDF', 'Download PDF', 'Email', 'WhatsApp', 'Print', 'Issue', 'Regenerate', 'Archive'].map(action => (
            <button key={action} onClick={() => onAction(action.toLowerCase().replace(/\s/g, '-'))} className="text-[11px] px-3 py-1.5 rounded border border-neutral-300 text-neutral-600 hover:bg-white transition-all">
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, color = 'text-neutral-800', bold }: { label: string; value: number; color?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className={`tabular-nums ${color} ${bold ? 'font-bold text-base' : ''}`}>
        R{Math.abs(value).toLocaleString()}
      </span>
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
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Description</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-24">Ex VAT</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-20">VAT</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {(section.data || []).map((line: any, i: number) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2.5 text-xs text-neutral-400">{line.charge_code || '—'}</td>
                <td className="py-2.5 text-sm text-neutral-800">{line.description}</td>
                <td className="py-2.5 text-sm text-neutral-800 text-right tabular-nums">R{line.amount.toLocaleString()}</td>
                <td className="py-2.5 text-sm text-neutral-500 text-right tabular-nums">R{line.vat_amount.toLocaleString()}</td>
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
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Ref</th>
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Transaction</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-28">Debit</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-28">Credit</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-28">Balance</th>
            </tr>
          </thead>
          <tbody>
                  {(section.data || []).map((line: any, j: number) => (
                    line.type === 'period_header' ? (
                      <tr key={j}><td colSpan={7} className="py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b-2 border-neutral-300 pt-4">{line.label}</td></tr>
                    ) : line.type === 'bf' ? (
                      <tr key={j} className="border-b border-neutral-200">
                        <td className="py-1 text-neutral-500 font-normal text-xs">{line.date}</td>
                        <td className="py-1 text-neutral-400 font-normal text-xs">B/F</td>
                        <td className="py-1 text-neutral-500 font-normal text-xs">{line.description}</td>
                        <td className="py-1 text-right"></td>
                        <td className="py-1 text-right"></td>
                        <td className="py-1 text-right"></td>
                        <td className="py-1 text-right font-medium tabular-nums text-xs">R{line.balance.toLocaleString()}</td>
                      </tr>
                    ) : line.type === 'cf' ? (
                      <tr key={j} className="border-t-2 border-neutral-300">
                        <td colSpan={6} className="py-1.5 text-right text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">{line.label}</td>
                        <td className="py-1.5 text-right font-bold tabular-nums text-xs">R{line.balance.toLocaleString()}</td>
                      </tr>
                    ) : (
                      <tr key={j} className="border-b border-neutral-100">
                        <td className="py-1 text-neutral-500 font-normal text-xs">{line.date}</td>
                        <td className="py-1 text-neutral-400 font-normal text-xs">{line.reference || '—'}</td>
                        <td className="py-1 text-neutral-800 font-normal text-xs">{line.description}</td>
                        <td className="py-1 text-right tabular-nums font-normal text-xs">{line.debit > 0 ? `R${line.debit.toLocaleString()}` : line.credit > 0 ? `(R${line.credit.toLocaleString()})` : ''}</td>
                        <td className="py-1 text-right tabular-nums font-normal text-xs text-neutral-500">{line.vat > 0 ? `R${line.vat.toLocaleString()}` : ''}</td>
                        <td className="py-1 text-right tabular-nums font-normal text-xs">{line.debit > 0 ? `R${(line.debit + (line.vat || 0)).toLocaleString()}` : line.credit > 0 ? `(R${line.credit.toLocaleString()})` : ''}</td>
                        <td className="py-1 text-right font-medium tabular-nums text-xs">R{line.balance.toLocaleString()}</td>
                      </tr>
                    )
                  ))}
                </tbody>
        </table>
      );

    default:
      return <p className="text-sm text-neutral-500 italic">{section.title || section.type}</p>;
  }
}
