'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const groups = [
  {
    label: 'General',
    items: [
      { key: '', label: 'Organisation' },
      { key: '/branding', label: 'Branding' },
      { key: '/notifications', label: 'Notifications' },
      { key: '/document-templates', label: 'Document Templates' },
      { key: '/feature-flags', label: 'Feature Flags' },
    ]
  },
  {
    label: 'Portfolio',
    items: [
      { key: '/entities', label: 'Entities' },
      { key: '/properties', label: 'Properties' },
      { key: '/property-groups', label: 'Property Groups' },
      { key: '/lease-templates', label: 'Lease Templates' },
    ]
  },
  {
    label: 'Financial',
    items: [
      { key: '/financial/chart-of-accounts', label: 'Chart of Accounts' },
      { key: '/financial/gl-mapping', label: 'GL Mapping' },
      { key: '/financial/banks', label: 'Banks' },
      { key: '/financial/cash-books', label: 'Cash Books' },
      { key: '/financial/vat', label: 'VAT' },
      { key: '/financial/periods', label: 'Financial Periods' },
      { key: '/financial/controls', label: 'Financial Controls' },
      { key: '/financial/charge-codes', label: 'Charge Codes' },
      { key: '/financial/revenue-categories', label: 'Revenue Categories' },
      { key: '/financial/deposit-types', label: 'Deposit Types' },
      { key: '/financial/supplier-types', label: 'Supplier Types' },
      { key: '/financial/supplier-categories', label: 'Supplier Categories' },
      { key: '/financial/posting-templates', label: 'Posting Templates' },
      { key: '/financial/invoice-config', label: 'Invoice { key: '/financial/invoice-config', label: 'Invoice & Statement Config' }, Statement Config' },
      { key: '/financial/billing-policies', label: 'Billing Policies' },
      { key: '/financial/payment-terms', label: 'Payment Terms' },
      { key: '/financial/defaults', label: 'Finance Defaults' },
    ]
  },
  {
    label: 'Communications',
    items: [
      { key: '/communications/email', label: 'Email Templates' },
      { key: '/communications/whatsapp', label: 'WhatsApp Templates' },
      { key: '/communications/reminders', label: 'Reminder Rules' },
      { key: '/communications/senders', label: 'Sender Accounts' },
    ]
  },
  {
    label: 'Security',
    items: [
      { key: '/users', label: 'Users' },
      { key: '/roles', label: 'Roles & Permissions' },
      { key: '/security/mfa', label: 'MFA' },
      { key: '/security/password-policy', label: 'Password Policy' },
      { key: '/security/session-policy', label: 'Session Policy' },
      { key: '/security/api-keys', label: 'API Keys' },
      { key: '/security/audit-log', label: 'Audit Log' },
      { key: '/security/activity-log', label: 'Activity Log' },
    ]
  },
  {
    label: 'Integrations',
    items: [
      { key: '/integrations/twilio', label: 'Twilio (WhatsApp)' },
      { key: '/integrations/email', label: 'Email Provider' },
      { key: '/integrations/bank-feeds', label: 'Bank Feeds' },
      { key: '/integrations/accounting-export', label: 'Accounting Export' },
      { key: '/integrations/document-storage', label: 'Document Storage' },
      { key: '/integrations/imports', label: 'Data Imports' },
      { key: '/integrations/webhooks', label: 'API Webhooks' },
    ]
  },
  {
    label: 'AI & Automation',
    items: [
      { key: '/ai/morning-brief', label: 'Morning Brief' },
      { key: '/ai/features', label: 'AI Features' },
      { key: '/ai/workflows', label: 'Workflow Automation' },
      { key: '/ai/scheduled-jobs', label: 'Scheduled Jobs' },
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
