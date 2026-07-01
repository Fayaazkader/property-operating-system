'use client';

import { useRouter } from 'next/navigation';
import { FileText, TrendingDown, Calendar, Building2, DollarSign, AlertTriangle, BarChart3, Download } from "lucide-react";

const reportCategories = [
  {
    category: "Financial",
    icon: DollarSign,
    reports: [
      { name: "Rent Roll", description: "All active leases with rental, deposits, and arrears", href: "/reports/rent-roll" },
      { name: "Arrears Report", description: "Aging analysis: current, 30, 60, 90, 120+ days", href: "/reports/arrears" },
      { name: "Income Statement", description: "Revenue by property, entity, and portfolio", href: "/reports/income-statement" },
      { name: "Recovery Analysis", description: "Utilities, rates, and operating costs recovered vs billed", href: "/reports/recovery" },
      { name: "Deposit Ledger", description: "Deposits received, interest, refunds, and balances", href: "/reports/deposits" },
    ],
  },
  {
    category: "Leasing",
    icon: Calendar,
    reports: [
      { name: "Lease Expiry Schedule", description: "Leases expiring by month, property, and entity", href: "/reports/lease-expiry" },
      { name: "Renewal Pipeline", description: "Leases expiring within 90 and 180 days", href: "/reports/renewals" },
      { name: "Escalation Schedule", description: "Upcoming escalations and projected revenue impact", href: "/reports/escalations" },
      { name: "Lease Audit", description: "All changes to lease terms, dates, and amounts", href: "/reports/lease-audit" },
    ],
  },
  {
    category: "Portfolio",
    icon: Building2,
    reports: [
      { name: "Occupancy Report", description: "Occupancy rates by property, type, and entity", href: "/reports/occupancy" },
      { name: "Vacancy Report", description: "Vacant units, lost revenue, and days vacant", href: "/reports/vacancy" },
      { name: "WALE Report", description: "Weighted Average Lease Expiry across portfolio", href: "/reports/wale" },
      { name: "Tenant Concentration", description: "Revenue concentration and risk exposure by tenant", href: "/reports/concentration" },
      { name: "NOI Report", description: "Net Operating Income per property", href: "/reports/noi" },
    ],
  },
  {
    category: "Operations",
    icon: BarChart3,
    reports: [
      { name: "Billing Summary", description: "Charges generated, billed, and unbilled", href: "/reports/billing" },
      { name: "Communications Report", description: "Sent, delivered, read, and failed by channel", href: "/reports/communications-report" },
      { name: "Task Report", description: "Open, overdue, and completed by assignee", href: "/reports/tasks-report" },
    ],
  },
];

export default function ReportsPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Reports</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">Financial, leasing, portfolio, and operational reports.</p>
      </div>

      {reportCategories.map(cat => (
        <div key={cat.category}>
          <div className="flex items-center gap-2 mb-3">
            <cat.icon className="w-4 h-4 text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-[0.1em]">{cat.category}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cat.reports.map(report => (
              <button
                key={report.name}
                onClick={() => router.push(report.href)}
                className="text-left rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 hover:border-[var(--border-hover)] transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{report.name}</p>
                  <Download className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">{report.description}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
