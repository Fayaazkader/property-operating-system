'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { key: '', label: 'Dashboard' },
  { key: '/invoices', label: 'Invoices' },
  { key: '/suppliers', label: 'Suppliers' },
  { key: '/credit-notes', label: 'Credit Notes' },
  { key: '/recurring', label: 'Recurring' },
  { key: '/aging', label: 'Aging' },
  { key: '/payments', label: 'Payment History' },
  { key: '/month-end', label: 'Month-End' },
  { key: '/reconciliation', label: 'Reconciliation' },
];

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-white/[0.06] p-4 space-y-1 flex-shrink-0 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-3">Accounts Payable</p>
        {navItems.map(item => (
          <Link key={item.key} href={`/suppliers${item.key}`}
            className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-light transition-colors ${pathname === `/suppliers${item.key}` ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'}`}>
            {item.label}
          </Link>
        ))}
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
