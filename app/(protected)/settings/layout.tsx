'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const groups = [
  {
    label: 'Platform',
    items: [
      { key: '', label: 'General' },
      { key: '/organisation', label: 'Organisation' },
      { key: '/users', label: 'Users & Roles' },
      { key: '/entities', label: 'Entities' },
      { key: '/properties', label: 'Properties' },
    ]
  },
  {
    label: 'Financial',
    items: [
      { key: '/financial/chart-of-accounts', label: 'Chart of Accounts' },
      { key: '/financial/vat', label: 'VAT Codes' },
      { key: '/financial/banks', label: 'Banks' },
      { key: '/financial/periods', label: 'Financial Periods' },
    ]
  },
  {
    label: 'Operational',
    items: [
      { key: '/operational/supplier-categories', label: 'Supplier Categories' },
      { key: '/operational/revenue-categories', label: 'Revenue Categories' },
    ]
  },
  {
    label: 'Other',
    items: [
      { key: '/notifications', label: 'Notifications' },
      { key: '/branding', label: 'Branding' },
      { key: '/developer', label: 'Developer' },
    ]
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-white/[0.06] p-4 space-y-6 flex-shrink-0 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3">Settings</p>
        {groups.map(group => (
          <div key={group.label} className="space-y-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-700 px-3">{group.label}</p>
            {group.items.map(item => (
              <Link key={item.key} href={`/settings${item.key}`}
                className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm font-light transition-colors ${pathname === `/settings${item.key}` ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'}`}>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="flex-1 p-8 overflow-y-auto">{children}</div>
    </div>
  );
}
