'use client';

import type { DocumentModel } from '../types';

interface RenderProps {
  model: DocumentModel;
  onAction?: (action: string) => void;
}

export function DocumentRenderer({ model, onAction }: RenderProps) {
  if (!model) return null;

  const isInvoice = model.metadata?.document_type === 'invoice';
  const m = model;

  return (
    <div className="bg-white text-neutral-800 font-sans shadow-2xl" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto' }}>
      
      {m.metadata?.status && m.metadata.status !== 'issued' && (
        <div className="bg-neutral-100 px-6 py-1.5 text-center border-b border-neutral-200">
          <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-neutral-500">{m.metadata.status}</span>
        </div>
      )}

      <div className="px-12 py-10 space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-neutral-900">{m.company?.name || 'Company'}</h2>
            {m.company?.registration_number && <p className="text-[9px] text-neutral-500">Reg: {m.company.registration_number}</p>}
            {m.company?.vat_number && <p className="text-[9px] text-neutral-500">VAT: {m.company.vat_number}</p>}
            {m.company?.physical_address && <p className="text-[9px] text-neutral-500 mt-1">{m.company.physical_address}</p>}
            {m.company?.telephone && <p className="text-[9px] text-neutral-500">Tel: {m.company.telephone}</p>}
            {m.company?.email && <p className="text-[9px] text-neutral-500">{m.company.email}</p>}
          </div>
          <div className="text-right space-y-0.5">
            <h1 className="text-base font-bold text-neutral-900 tracking-tight">
              {isInvoice ? 'TAX INVOICE' : 'STATEMENT OF ACCOUNT'}
            </h1>
            <p className="text-[9px] text-neutral-500">{m.metadata?.document_number}</p>
            <div className="text-[9px] text-neutral-600 space-y-0.5 mt-2">
              <p>{isInvoice ? 'Issue' : 'Statement'} Date: {m.metadata?.issue_date}</p>
              {isInvoice && m.metadata?.due_date && <p>Due: {m.metadata.due_date}</p>}
              {m.metadata?.billing_period && <p>Period: {m.metadata.billing_period}</p>}
            </div>
          </div>
        </div>

        {/* CUSTOMER */}
        <div className="border-t border-b border-neutral-200 py-3 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Bill To</p>
            <p className="text-xs font-bold text-neutral-800">{m.customer?.name}</p>
            {m.customer?.lease_ref && <p className="text-[9px] text-neutral-500">Lease: {m.customer.lease_ref}</p>}
          </div>
          <div>
            {m.customer?.property_name && <p className="text-xs text-neutral-700">{m.customer.property_name}</p>}
            {m.customer?.unit && <p className="text-[9px] text-neutral-500">{m.customer.unit}</p>}
          </div>
        </div>

        {/* STATEMENT: ACCOUNT SUMMARY */}
        {!isInvoice && m.account_summary && (
          <div className="border-2 border-neutral-900 rounded p-4 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-900 text-center">Account Summary</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-neutral-600">Opening Balance</span><span className="tabular-nums">R{m.account_summary.opening_balance.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs"><span className="text-neutral-600">Charges Raised</span><span className="tabular-nums">R{m.account_summary.current_charges.toLocaleString()}</span></div>
              {m.account_summary.payments_received > 0 && <div className="flex justify-between text-xs"><span className="text-emerald-600">Payments Received</span><span className="text-emerald-600 tabular-nums">-R{m.account_summary.payments_received.toLocaleString()}</span></div>}
              {m.account_summary.credit_notes > 0 && <div className="flex justify-between text-xs"><span className="text-red-600">Credit Notes</span><span className="text-red-600 tabular-nums">-R{m.account_summary.credit_notes.toLocaleString()}</span></div>}
              <div className="border-t border-neutral-300 pt-1.5" />
              <div className="flex justify-between text-xs font-bold"><span className="text-neutral-900">Closing Balance</span><span className="tabular-nums">R{m.account_summary.closing_balance.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs font-bold"><span className="text-neutral-900">Amount Due</span><span className="tabular-nums">R{m.account_summary.amount_due.toLocaleString()}</span></div>
            </div>
          </div>
        )}

        {/* SECTIONS */}
        {m.sections?.map((section: any, i: number) => (
          <div key={i}>
            {section.title && (
              <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">{section.title}</p>
            )}
            {section.type === 'charges' && (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b-2 border-neutral-300">
                    <th className="text-left py-1.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">Description</th>
                    <th className="text-right py-1.5 text-[8px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Ex VAT</th>
                    <th className="text-right py-1.5 text-[8px] font-semibold uppercase tracking-wider text-neutral-500 w-14">VAT</th>
                    <th className="text-right py-1.5 text-[8px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Incl VAT</th>
                    <th className="text-right py-1.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-500 w-16">VAT</th>
                    <th className="text-right py-1.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(section.data || []).map((line: any, j: number) => (
                    <tr key={j} className="border-b border-neutral-100">
                      <td className="py-1.5 text-neutral-800">{line.description}</td>
                      <td className="py-1.5 text-right tabular-nums">R{line.amount.toLocaleString()}</td>
                      <td className="py-1.5 text-right text-neutral-500 tabular-nums">R{line.vat_amount.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-medium tabular-nums">R{line.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {section.type === 'ledger' && (
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b-2 border-neutral-300">
                    <th className="text-left py-1.5 text-[8px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Date</th>
                    <th className="text-left py-1.5 text-[8px] font-semibold uppercase tracking-wider text-neutral-500 w-24">Ref</th>
                    <th className="text-left py-1.5 text-[8px] font-semibold uppercase tracking-wider text-neutral-500">Description</th>
                    <th className="text-right py-1.5 text-[8px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Ex VAT</th>
                    <th className="text-right py-1.5 text-[8px] font-semibold uppercase tracking-wider text-neutral-500 w-16">VAT</th>
                    <th className="text-right py-1.5 text-[8px] font-semibold uppercase tracking-wider text-neutral-500 w-20">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(section.data || []).map((line: any, j: number) => (
                    <tr key={j} className="border-b border-neutral-100">
                      <td className="py-1 text-neutral-500 font-normal">{line.date}</td>
                      <td className="py-1 text-neutral-400 font-normal">{line.reference || '—'}</td>
                      <td className="py-1 text-neutral-800 font-normal">{line.description}</td>
                      <td className="py-1 text-right tabular-nums font-normal">{line.debit > 0 ? `R${line.debit.toLocaleString()}` : line.credit > 0 ? `(R${line.credit.toLocaleString()})` : ''}</td>
                      <td className="py-1 text-right tabular-nums font-normal text-neutral-500">{line.debit > 0 && line.vat > 0 ? `R${line.vat.toLocaleString()}` : ''}</td>
                      <td className="py-1 text-right tabular-nums font-normal">{line.debit > 0 ? `R${(line.debit + (line.vat || 0)).toLocaleString()}` : line.credit > 0 ? `(R${line.credit.toLocaleString()})` : ''}</td>
                      <td className="py-1 text-right font-medium tabular-nums">R{line.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {/* INVOICE TOTALS */}
        {isInvoice && (
          <div className="space-y-1.5 pt-3 border-t-2 border-neutral-900">
            <div className="flex justify-between text-xs"><span className="text-neutral-500">Subtotal</span><span className="tabular-nums">R{m.totals?.subtotal?.toLocaleString()}</span></div>
            <div className="flex justify-between text-xs"><span className="text-neutral-500">VAT</span><span className="tabular-nums">R{m.totals?.vat_total?.toLocaleString()}</span></div>
            <div className="flex justify-between text-xs font-bold pt-1"><span className="uppercase tracking-wider">Total Due</span><span className="tabular-nums">R{m.totals?.balance_due?.toLocaleString()}</span></div>
          </div>
        )}

        {/* AGING */}
        {!isInvoice && m.aging && m.aging.length > 0 && (
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Current Aging</p>
            <div className="grid grid-cols-5 gap-2">
              {m.aging.map((bucket: any, i: number) => (
                <div key={i} className={`text-center py-1.5 rounded ${bucket.amount > 0 ? 'bg-red-50' : 'bg-neutral-50'}`}>
                  <p className="text-[8px] text-neutral-500">{bucket.label}</p>
                  <p className={`text-[10px] font-semibold tabular-nums ${bucket.amount > 0 ? 'text-red-600' : 'text-neutral-400'}`}>R{bucket.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BANKING (invoice only) */}
        {isInvoice && m.banking && (
          <div className="border-t border-neutral-200 pt-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Payment Details</p>
            <div className="text-[10px] text-neutral-600 space-y-0.5">
              <p>Bank: {m.banking.bank_name} | Account: {m.banking.account_number} | Ref: {m.banking.reference}</p>
            </div>
          </div>
        )}

        {/* CONTACTS (statement only) */}
        {!isInvoice && m.contacts && (
          <div className="border-t border-neutral-200 pt-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Account Queries</p>
            <div className="text-[10px] text-neutral-600">
              {m.contacts.accounts_email && <span>Accounts: {m.contacts.accounts_email}</span>}
              {m.contacts.accounts_phone && <span className="ml-4">Tel: {m.contacts.accounts_phone}</span>}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="border-t border-neutral-200 pt-3 text-center space-y-1">
          {m.footer_message && <p className="text-[9px] text-neutral-400">{m.footer_message}</p>}
          {m.branding?.show_powered_by && (
            <p className="text-[8px] text-neutral-300">Generated by AssetFlow — Commercial Property Operating System</p>
          )}
        </div>
      </div>

      {/* ACTIONS */}
      {onAction && (
        <div className="border-t border-neutral-200 px-12 py-3 flex gap-2 justify-end bg-neutral-50 print:hidden">
          {['PDF', 'Email', 'WhatsApp', 'Print', 'Issue'].map(action => (
            <button key={action} onClick={() => onAction(action.toLowerCase())} className="text-[10px] px-3 py-1 rounded border border-neutral-300 text-neutral-600 hover:bg-white transition-all">
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
