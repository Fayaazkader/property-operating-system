'use client';

export type DocumentMode = 'invoice' | 'statement';
export type DocumentStatus = 'draft' | 'preview' | 'issued' | 'cancelled' | 'superseded';

interface DocumentPreviewProps {
  data: any;
  mode: DocumentMode;
  onAction?: (action: string) => void;
}

export default function DocumentPreview({ data, mode, onAction }: DocumentPreviewProps) {
  if (!data) return null;

  const isInvoice = mode === 'invoice';
  const title = isInvoice ? 'Tax Invoice' : 'Statement of Account';
  const statusBanner: Record<DocumentStatus, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'DRAFT' },
    preview: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'PREVIEW' },
    issued: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'ISSUED' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-600', label: 'CANCELLED' },
    superseded: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'SUPERSEDED' },
  };
  const status = statusBanner[data.status as DocumentStatus] || statusBanner.draft;

  return (
    <div className="relative bg-white text-black rounded-xl overflow-hidden shadow-2xl" id="document-preview">
      {/* Status Banner */}
      <div className={`${status.bg} px-6 py-2 text-center`}>
        <p className={`text-[10px] font-semibold uppercase tracking-[0.3em] ${status.text}`}>{status.label}</p>
      </div>


      <div className="relative p-8 md:p-12 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            {data.logo_url && <img src={data.logo_url} alt="Logo" className="h-10 mb-3" />}
            {data.company_name && <h2 className="text-lg font-bold text-black">{data.company_name}</h2>}
            {data.company_address && <p className="text-xs text-gray-500">{data.company_address}</p>}
            {data.company_contact && <p className="text-xs text-gray-500">{data.company_contact}</p>}
            {data.company_vat_number && <p className="text-xs text-gray-500">VAT: {data.company_vat_number}</p>}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-black uppercase tracking-wider">{title}</h1>
            <p className="text-xs text-gray-500 mt-1">{data.statement_date}</p>
            <p className="text-xs text-gray-500">v{data.version}</p>
          </div>
        </div>

        {/* Tenant Info */}
        <div className="border-t border-b border-gray-200 py-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Bill To</p>
            <p className="text-sm font-semibold text-black">{data.tenant_name}</p>
            <p className="text-xs text-gray-500">{data.property_name}</p>
            <p className="text-xs text-gray-500">Lease: {data.lease_ref}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Date</p>
            <p className="text-sm text-black">{data.statement_date}</p>
          </div>
        </div>

        {/* Custom Header Message */}
        {data.header_message && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">{data.header_message}</p>
          </div>
        )}

        {/* INVOICE: Charges only. STATEMENT: Full history */}
        {isInvoice ? (
          <InvoiceLines data={data} />
        ) : (
          <StatementLines data={data} />
        )}

        {/* Deposit */}
        {data.deposit_held !== undefined && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Deposit Held</span>
              <span className="text-black font-medium tabular-nums">R{data.deposit_held.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="border-t-2 border-black pt-4 flex justify-between">
          <span className="text-lg font-bold text-black">Balance Due</span>
          <span className="text-lg font-bold text-black tabular-nums">R{(data.closing_balance || 0).toLocaleString()}</span>
        </div>

        {/* Custom Footer Message */}
        {data.footer_message && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500">{data.footer_message}</p>
          </div>
        )}

        {/* Powered by */}
        <div className="border-t border-gray-200 pt-4 text-center">
          <p className="text-[9px] text-gray-300">Powered by AssetFlow — Commercial Property Operating System</p>
        </div>
      </div>

      {/* Actions */}
      {onAction && (
        <div className="border-t border-gray-200 px-8 py-4 flex gap-3 justify-end bg-gray-50">
          {['download', 'email', 'whatsapp', 'print', 'regenerate', 'issue', 'cancel'].map(action => (
            <button
              key={action}
              onClick={() => onAction(action)}
              className="text-[11px] px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 transition-all capitalize"
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceLines({ data }: any) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-3">Charges</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-400 font-medium">Description</th>
            <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(data.posted_lines || []).filter((l: any) => l.debit > 0).map((line: any, i: number) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2 text-xs text-black">{line.description}</td>
              <td className="py-2 text-xs text-black text-right tabular-nums">R{line.debit.toLocaleString()}</td>
            </tr>
          ))}
          {/* Credit notes */}
          {(data.posted_lines || []).filter((l: any) => l.credit > 0 && l.description?.toLowerCase().includes('credit')).map((line: any, i: number) => (
            <tr key={`cn-${i}`} className="border-b border-gray-100">
              <td className="py-2 text-xs text-red-600">{line.description}</td>
              <td className="py-2 text-xs text-red-600 text-right tabular-nums">-R{line.credit.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Receipts (if balance b/f shown) */}
      {(data.posted_lines || []).filter((l: any) => l.credit > 0 && !l.description?.toLowerCase().includes('credit')).length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-3">Receipts</p>
          <table className="w-full text-sm">
            <tbody>
              {(data.posted_lines || []).filter((l: any) => l.credit > 0 && !l.description?.toLowerCase().includes('credit')).map((line: any, i: number) => (
                <tr key={`rec-${i}`} className="border-b border-gray-100">
                  <td className="py-2 text-xs text-emerald-700">{line.description}</td>
                  <td className="py-2 text-xs text-emerald-700 text-right tabular-nums">-R{line.credit.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatementLines({ data }: any) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-3">Transaction History</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-400 font-medium">Date</th>
            <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-400 font-medium">Description</th>
            <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-medium">Debit</th>
            <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-medium">Credit</th>
            <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {(data.posted_lines || []).map((line: any, i: number) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2 text-xs text-gray-500">{line.date}</td>
              <td className="py-2 text-xs text-black">{line.description}</td>
              <td className="py-2 text-xs text-black text-right tabular-nums">{line.debit > 0 ? `R${line.debit.toLocaleString()}` : ''}</td>
              <td className="py-2 text-xs text-black text-right tabular-nums">{line.credit > 0 ? `R${line.credit.toLocaleString()}` : ''}</td>
              <td className="py-2 text-xs text-black text-right tabular-nums font-medium">R{line.balance?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Projected */}
      {(data.projected_charges || []).length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-3">Projected</p>
          <table className="w-full text-sm">
            <tbody>
              {data.projected_charges.map((charge: any, i: number) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 text-xs text-gray-500 italic">{charge.description}</td>
                  <td className="py-2 text-xs text-gray-400 italic">{charge.confidence}</td>
                  <td className="py-2"></td>
                  <td className="py-2 text-xs text-gray-400 text-right tabular-nums">{charge.amount > 0 ? `R${charge.amount.toLocaleString()}` : 'TBD'}</td>
                  <td className="py-2"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
