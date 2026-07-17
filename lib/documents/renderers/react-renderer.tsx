// lib/documents/renderers/react-renderer.tsx
// React renderer for document models

import type { DocumentModel } from '../types';

interface RenderProps {
  model: DocumentModel;
  onAction?: (action: string) => void;
}

export function DocumentRenderer({ model, onAction }: RenderProps) {
  const isInvoice = model.metadata.document_type === 'invoice';

  return (
    <div className="bg-white text-neutral-800 rounded-lg shadow-2xl max-w-2xl mx-auto font-sans print:shadow-none print:rounded-none">
      
      {model.metadata.status !== 'issued' && (
        <div className="bg-neutral-100 px-8 py-2 text-center border-b border-neutral-200">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500">{model.metadata.status}</span>
        </div>
      )}

      <div className="p-10 space-y-8">
        
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
              {isInvoice ? 'TAX INVOICE' : 'STATEMENT OF ACCOUNT'}
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              {isInvoice ? `Invoice Date: ${model.metadata.issue_date}` : `Statement Date: ${model.metadata.issue_date}`}
            </p>
            {model.metadata.due_date && (
              <p className="text-xs text-neutral-500">Due Date: {model.metadata.due_date}</p>
            )}
          </div>
          <div className="text-right">
            {model.branding.logo_url && <img src={model.branding.logo_url} alt="Logo" className="h-8 mb-2 ml-auto" />}
            <p className="text-lg font-bold text-neutral-900">{model.company.name}</p>
            {model.company.vat_number && <p className="text-[10px] text-neutral-400">VAT: {model.company.vat_number}</p>}
          </div>
        </div>

        {/* FROM / TO */}
        <div className="grid grid-cols-2 gap-8 pb-6 border-b border-neutral-200">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">From</p>
            <p className="text-sm font-semibold text-neutral-800">{model.company.name}</p>
            {model.company.physical_address && <p className="text-xs text-neutral-500">{model.company.physical_address}</p>}
            {model.company.telephone && <p className="text-xs text-neutral-500">Tel: {model.company.telephone}</p>}
            {model.company.email && <p className="text-xs text-neutral-500">{model.company.email}</p>}
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">To</p>
            <p className="text-sm font-semibold text-neutral-800">{model.customer.name}</p>
            {model.customer.property_name && <p className="text-xs text-neutral-500">{model.customer.property_name}</p>}
            {model.customer.lease_ref && <p className="text-xs text-neutral-500">Ref: {model.customer.lease_ref}</p>}
          </div>
        </div>

        {/* HEADER MESSAGE */}
        {model.header_message && (
          <div className="bg-neutral-50 border border-neutral-100 rounded p-3">
            <p className="text-xs text-neutral-600">{model.header_message}</p>
          </div>
        )}

        {/* SECTIONS */}
        {model.sections.map((section, i) => (
          <div key={i}>
            {section.title && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">{section.title}</p>
            )}
            <SectionRenderer section={section} />
          </div>
        ))}

        {/* TOTALS */}
        <div className="space-y-2 pt-4 border-t-2 border-neutral-900">
          {isInvoice && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Subtotal</span>
                <span className="text-neutral-800 tabular-nums">R{model.totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">VAT</span>
                <span className="text-neutral-800 tabular-nums">R{model.totals.vat_total.toLocaleString()}</span>
              </div>
              {model.totals.payments_received > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600">Payments Received</span>
                  <span className="text-emerald-600 tabular-nums">-R{model.totals.payments_received.toLocaleString()}</span>
                </div>
              )}
              {model.totals.credits_applied > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Credits Applied</span>
                  <span className="text-red-600 tabular-nums">-R{model.totals.credits_applied.toLocaleString()}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
              {isInvoice ? 'Total Due' : 'Balance Outstanding'}
            </span>
            <span className="text-xl font-bold text-neutral-900 tabular-nums">
              R{model.totals.balance_due.toLocaleString()}
            </span>
          </div>
        </div>

        {/* DEPOSIT */}
        {model.deposit_held !== undefined && model.deposit_held > 0 && (
          <div className="flex justify-between text-sm py-2 border-t border-neutral-200">
            <span className="text-neutral-500">Deposit Held</span>
            <span className="text-neutral-700 tabular-nums">R{model.deposit_held.toLocaleString()}</span>
          </div>
        )}

        {/* BANKING */}
        {model.banking && (
          <div className="border-t border-neutral-200 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Banking Details</p>
            <div className="text-xs text-neutral-600 space-y-0.5">
              <p>Bank: {model.banking.bank_name}</p>
              <p>Account: {model.banking.account_number}</p>
              <p>Reference: {model.banking.reference}</p>
            </div>
          </div>
        )}

        {/* FOOTER */}
        {model.footer_message && (
          <div className="text-[10px] text-neutral-400 text-center pt-4 border-t border-neutral-100">
            {model.footer_message}
          </div>
        )}

        {model.branding.show_powered_by && (
          <div className="text-[9px] text-neutral-300 text-center pt-1">
            Powered by AssetFlow — Commercial Property Operating System
          </div>
        )}
      </div>

      {/* ACTIONS */}
      {onAction && (
        <div className="border-t border-neutral-200 px-10 py-4 flex gap-2 justify-end bg-neutral-50 rounded-b-lg print:hidden">
          {['Download PDF', 'Email', 'WhatsApp', 'Print', 'Issue', 'Cancel'].map(action => (
            <button
              key={action}
              onClick={() => onAction(action.toLowerCase().replace(' ', '-'))}
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

function SectionRenderer({ section }: { section: any }) {
  switch (section.type) {
    case 'charges':
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-16">Code</th>
              <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Description</th>
              <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(section.data || []).map((line: any, i: number) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2.5 text-xs text-neutral-400">{line.gl_code || line.charge_code || '—'}</td>
                <td className="py-2.5 text-sm text-neutral-800">{line.description}</td>
                <td className="py-2.5 text-sm text-neutral-800 text-right tabular-nums">R{line.amount.toLocaleString()}</td>
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
                <td className="py-2.5 text-sm text-neutral-800">{line.description}</td>
                <td className="py-2.5 text-sm text-neutral-800 text-right tabular-nums">{line.debit > 0 ? `R${line.debit.toLocaleString()}` : ''}</td>
                <td className="py-2.5 text-sm text-neutral-800 text-right tabular-nums">{line.credit > 0 ? `R${line.credit.toLocaleString()}` : ''}</td>
                <td className="py-2.5 text-sm font-medium text-neutral-800 text-right tabular-nums">R{line.balance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    default:
      return <p className="text-sm text-neutral-500">Unknown section: {section.type}</p>;
  }
}
