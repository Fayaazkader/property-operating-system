"use client";

import { useRef } from "react";

type ChargeDetail = {
  description: string;
  amount_excl: number;
  vat_amount: number;
  amount_incl: number;
  gl_code: string;
};

type BillingPreviewItem = {
  entity: string;
  property: string;
  tenant: string;
  total: number;
  charges: ChargeDetail[];
};

type Props = {
  data: BillingPreviewItem[];
  viewBy: string;
  scopeLabel: string;
  period: string;
  onClose: () => void;
};

export default function PreBillingVerification({ data, viewBy, scopeLabel, period, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  if (data.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-white text-black rounded-3xl w-full max-w-lg mx-4 shadow-2xl p-8 text-center">
          <p className="text-lg font-semibold mb-2">No Data</p>
          <p className="text-gray-500 text-sm mb-4">No billing data available for the selected scope.</p>
          <button onClick={onClose} className="rounded-xl bg-black text-white px-6 py-2 text-sm font-semibold">Close</button>
        </div>
      </div>
    );
  }

  // Group based on viewBy
  const getGrouped = () => {
    if (viewBy === "tenant") {
      // Single tenant — just show as is
      return { grouped: { [scopeLabel]: data }, totals: calculateTotals(data) };
    }

    if (viewBy === "property") {
      const grouped: Record<string, BillingPreviewItem[]> = {};
      data.forEach(item => {
        if (!grouped[item.property]) grouped[item.property] = [];
        grouped[item.property].push(item);
      });
      return { grouped, totals: calculateTotals(data) };
    }

    if (viewBy === "entity" || viewBy === "tenantGroup" || viewBy === "region" || viewBy === "propertyType") {
      const grouped: Record<string, Record<string, BillingPreviewItem[]>> = {};
      data.forEach(item => {
        const key = item.entity;
        if (!grouped[key]) grouped[key] = {};
        if (!grouped[key][item.property]) grouped[key][item.property] = [];
        grouped[key][item.property].push(item);
      });
      return { grouped, totals: calculateTotals(data) };
    }

    // "all" — group by entity → property
    const grouped: Record<string, Record<string, BillingPreviewItem[]>> = {};
    data.forEach(item => {
      if (!grouped[item.entity]) grouped[item.entity] = {};
      if (!grouped[item.entity][item.property]) grouped[item.entity][item.property] = [];
      grouped[item.entity][item.property].push(item);
    });
    return { grouped, totals: calculateTotals(data) };
  };

  const calculateTotals = (items: BillingPreviewItem[]) => {
    const excl = items.reduce((s, i) => s + i.charges.reduce((c, ch) => c + ch.amount_excl, 0), 0);
    const vat = items.reduce((s, i) => s + i.charges.reduce((c, ch) => c + ch.vat_amount, 0), 0);
    const incl = items.reduce((s, i) => s + i.total, 0);
    return { excl, vat, incl };
  };

  const { grouped, totals } = getGrouped();
  const tenantCount = data.length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white text-black rounded-3xl w-full max-w-5xl mx-4 shadow-2xl max-h-[95vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none" ref={printRef}>
        
        {/* Print Header */}
        <div className="sticky top-0 bg-white border-b-2 border-black px-8 py-6 rounded-t-3xl print:rounded-none z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-semibold">PRE-BILLING VERIFICATION REPORT</p>
              <h1 className="text-xl font-bold text-black mt-2">{scopeLabel}</h1>
              <p className="text-sm text-gray-600 mt-1">Statement Period: {period}</p>
              <p className="text-xs text-gray-400 mt-0.5">Generated: {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <div className="flex items-center gap-3 print:hidden">
              <button onClick={handlePrint} className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100">🖨 Print</button>
              <button onClick={onClose} className="text-gray-400 hover:text-black text-xl">✕</button>
            </div>
          </div>

          {/* Portfolio Summary */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-gray-100 rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase text-gray-500">Balance B/F</p>
              <p className="text-base font-bold tabular-nums">R0.00</p>
            </div>
            <div className="bg-gray-100 rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase text-gray-500">Charges</p>
              <p className="text-base font-bold tabular-nums">R{totals.incl.toFixed(2)}</p>
            </div>
            <div className="bg-gray-100 rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase text-gray-500">Receipts</p>
              <p className="text-base font-bold tabular-nums">R0.00</p>
            </div>
            <div className="bg-black text-white rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase text-white/60">Balance C/F</p>
              <p className="text-base font-bold tabular-nums">R{totals.incl.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          {viewBy === "all" || viewBy === "entity" || viewBy === "tenantGroup" || viewBy === "region" || viewBy === "propertyType" ? (
            // Multi-level grouping
            Object.entries(grouped as Record<string, Record<string, BillingPreviewItem[]>>).map(([entity, properties]) => {
              const entityItems = Object.values(properties).flat();
              const entityTotals = calculateTotals(entityItems);
              return (
                <div key={entity}>
                  <div className="border-b-2 border-black pb-2 mb-4">
                    <p className="text-base font-bold text-black">{entity}</p>
                    <div className="flex gap-6 text-xs text-gray-500 mt-1">
                      <span>{Object.keys(properties).length} properties</span>
                      <span>{entityItems.length} tenants</span>
                      <span>Charges: R{entityTotals.incl.toFixed(2)}</span>
                    </div>
                  </div>
                  {Object.entries(properties).map(([property, tenants]) => {
                    const propTotals = calculateTotals(tenants);
                    return (
                      <div key={property} className="ml-4 mb-4">
                        <p className="text-sm font-semibold text-gray-800 mb-1">{property}</p>
                        {tenants.map((item) => (
                          <TenantCard key={item.tenant} item={item} />
                        ))}
                        <div className="flex justify-end text-xs text-gray-500 mt-1 gap-4">
                          <span>Property Excl: R{propTotals.excl.toFixed(2)}</span>
                          <span>VAT: R{propTotals.vat.toFixed(2)}</span>
                          <span className="font-semibold">Total: R{propTotals.incl.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          ) : viewBy === "property" ? (
            // Property → Tenant
            Object.entries(grouped as Record<string, BillingPreviewItem[]>).map(([property, tenants]) => {
              const propTotals = calculateTotals(tenants);
              return (
                <div key={property}>
                  <div className="border-b-2 border-black pb-2 mb-4">
                    <p className="text-base font-bold text-black">{property}</p>
                    <p className="text-xs text-gray-500">{tenants.length} tenants</p>
                  </div>
                  {tenants.map((item) => (
                    <TenantCard key={item.tenant} item={item} />
                  ))}
                  <div className="flex justify-end text-sm font-bold text-black mt-2 gap-4 border-t border-gray-300 pt-2">
                    <span>Property Total: R{propTotals.incl.toFixed(2)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            // Tenant only
            data.map((item) => (
              <TenantCard key={item.tenant} item={item} />
            ))
          )}

          {/* Grand Totals */}
          <div className="border-t-2 border-black pt-6 mt-6">
            <p className="text-sm font-bold text-black mb-4">PRE-BILLING SUMMARY — {scopeLabel}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-500">Total Charges Excl VAT</p>
                <p className="text-xl font-bold tabular-nums">R{totals.excl.toFixed(2)}</p>
              </div>
              <div className="bg-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-500">Total VAT</p>
                <p className="text-xl font-bold tabular-nums">R{totals.vat.toFixed(2)}</p>
              </div>
              <div className="bg-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-500">Total Charges Incl VAT</p>
                <p className="text-xl font-bold tabular-nums">R{totals.incl.toFixed(2)}</p>
              </div>
              <div className="bg-black text-white rounded-xl p-4">
                <p className="text-xs text-white/60">Balance C/F</p>
                <p className="text-xl font-bold tabular-nums">R{totals.incl.toFixed(2)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-gray-500">
              <div className="text-center"><span className="font-semibold text-black">{tenantCount}</span> tenants</div>
              <div className="text-center"><span className="font-semibold text-black">{data.reduce((s, i) => s + i.charges.length, 0)}</span> charge lines</div>
              <div className="text-center"><span className="font-semibold text-black">{Object.keys(grouped).length}</span> groups</div>
            </div>
            <div className="mt-6 border-t border-gray-200 pt-4 grid grid-cols-2 gap-8 text-xs text-gray-400">
              <div>
                <p className="mb-1">Prepared By:</p>
                <div className="border-b border-gray-300 h-6"></div>
              </div>
              <div>
                <p className="mb-1">Approved By:</p>
                <div className="border-b border-gray-300 h-6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantCard({ item }: { item: BillingPreviewItem }) {
  return (
    <div className="ml-4 mb-3 border border-gray-200 rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-semibold text-black">{item.tenant}</p>
        <p className="text-xs text-gray-400">R{item.total.toFixed(2)}</p>
      </div>

      {/* Balance B/F */}
      <div className="flex justify-between text-xs text-gray-400 mb-2 py-1 border-b border-gray-100">
        <span>Balance B/F</span>
        <span className="tabular-nums">R0.00</span>
      </div>

      {/* Charges */}
      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-1 text-gray-400 font-normal">Description</th>
            <th className="text-right py-1 text-gray-400 font-normal w-20">Excl VAT</th>
            <th className="text-right py-1 text-gray-400 font-normal w-16">VAT</th>
            <th className="text-right py-1 text-gray-400 font-normal w-20">Incl VAT</th>
          </tr>
        </thead>
        <tbody>
          {item.charges.map((charge, cIdx) => (
            <tr key={cIdx} className="border-b border-gray-50">
              <td className="py-1 text-black">{charge.description}</td>
              <td className="py-1 text-right tabular-nums">R{charge.amount_excl.toFixed(2)}</td>
              <td className="py-1 text-right tabular-nums">R{charge.vat_amount.toFixed(2)}</td>
              <td className="py-1 text-right tabular-nums font-medium">R{charge.amount_incl.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Receipts */}
      <div className="flex justify-between text-xs text-gray-400 mb-2 py-1 border-b border-gray-100">
        <span>Receipts</span>
        <span className="tabular-nums">R0.00</span>
      </div>

      {/* Balance C/F */}
      <div className="flex justify-between text-sm font-bold text-black pt-2 border-t-2 border-gray-300">
        <span>Balance C/F</span>
        <span className="tabular-nums">R{item.total.toFixed(2)}</span>
      </div>
    </div>
  );
}
