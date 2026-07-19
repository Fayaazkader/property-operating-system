'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const routeLabels: Record<string, string> = {
  '': 'Dashboard', 'financials': 'Financials', 'cash-book': 'Cash Book', 'imports': 'Imports',
  'revenue': 'Revenue Ops', 'suppliers': 'Suppliers', 'invoices': 'Invoices',
  'credit-notes': 'Credit Notes', 'recurring': 'Recurring', 'aging': 'Aging',
  'payments': 'Payments', 'month-end': 'Month-End', 'reconciliation': 'Reconciliation',
  'approval-queue': 'Approval Queue', 'settings': 'Settings', 'properties': 'Properties',
  'tenants': 'Tenants', 'reports': 'Reports', 'leasing': 'Leasing', 'trial-balance': 'Trial Balance',
  'income-statement': 'Income Statement', 'balance-sheet': 'Balance Sheet', 'cash-flow': 'Cash Flow',
  'journals': 'Journals', 'vat': 'VAT', 'budget': 'Budget', 'close': 'Close Assistant', 'allocate': 'Allocate',
};

const idResolvers: Record<string, { table: string; select: string; field: string }> = {
  'cash-book': { table: 'bank_accounts', select: 'bank_name, account_name', field: 'account_name' },
  'suppliers': { table: 'suppliers', select: 'supplier_name', field: 'supplier_name' },
  'invoices': { table: 'supplier_invoices_new', select: 'invoice_number', field: 'invoice_number' },
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  const segments = pathname.split('/').filter(Boolean);
  
  // Hide on dashboard, skip 'financials' prefix for workspace pages
  if (segments.length === 0) return null;
  const displaySegments = segments[0] === 'financials' && segments.length > 1 ? segments.slice(1) : segments;
  if (displaySegments.length === 0) return null;

  useEffect(() => {
    async function resolveNames() {
      const names: Record<string, string> = {};
      for (let i = 0; i < displaySegments.length; i++) {
        const seg = displaySegments[i];
        const prev = displaySegments[i - 1];
        const resolver = idResolvers[prev || ''];
        if (resolver && seg && seg.length > 30) {
          const { data } = await supabase.from(resolver.table).select(resolver.select).eq('id', seg).single();
          if (data) names[seg] = data[resolver.field] || seg.slice(0, 8);
        }
      }
      setResolvedNames(names);
    }
    resolveNames();
  }, [pathname]);

  return (
    <nav className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-light py-2 overflow-x-auto">
      {displaySegments.map((seg, i) => {
        const href = '/' + segments.slice(0, segments.indexOf(seg) + 1).join('/');
        const isLast = i === displaySegments.length - 1;
        const label = resolvedNames[seg] || routeLabels[seg] || seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-zinc-700">/</span>}
            {isLast ? (
              <span className="text-zinc-300">{label.length > 25 ? label.slice(0, 25) + '…' : label}</span>
            ) : (
              <Link href={href} className="hover:text-white transition-colors truncate max-w-[150px]">{label.length > 25 ? label.slice(0, 25) + '…' : label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
