"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { 
  Home, FileText, Receipt, Landmark, MessageSquare, CheckSquare,
  Building2, Users, Briefcase,
  Upload, Calendar, Settings
} from "lucide-react";

const navItems = [
  { label: "Morning Brief", href: "/", icon: Home, desc: "Portfolio Overview" },
  { section: "divider" },
  { section: "header", label: "OPERATIONS" },
  { label: "Leases", href: "/leases", icon: FileText, desc: "Lease Lifecycle · Renewals · Documents" },
  { label: "Revenue Ops", href: "/financials/revenue", icon: Receipt, desc: "Billing · Statements · Utilities" },
  { label: "Cash Book", href: "/financials/cash-book", icon: Landmark, desc: "Banking · Reconciliation · Allocation" },
  { label: "Communications", href: "/communications", icon: MessageSquare, desc: "Email · WhatsApp · Statements" },
  { label: "Tasks", href: "/tasks", icon: CheckSquare, desc: "Workflows · Approvals · Follow Ups" },
  { section: "divider" },
  { section: "header", label: "PORTFOLIO" },
  { label: "Properties", href: "/properties", icon: Building2, desc: "Buildings · Occupancy · Units" },
  { label: "Tenants", href: "/tenants", icon: Users, desc: "Accounts · Statements · Communications" },
  { label: "Suppliers", href: "/suppliers", icon: Briefcase, desc: "Invoices · Payments · Contracts" },
  { section: "divider" },
  { section: "header", label: "SYSTEM" },
  { label: "Imports", href: "/financials/imports", icon: Upload, desc: "Migration · Validation · Templates" },
  { label: "Statement Periods", href: "/financials/periods", icon: Calendar, desc: "Billing Cycles · Governance" },
  { label: "Settings", href: "/settings", icon: Settings, desc: "Platform · Preferences · Integrations" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);

  return (
    <aside className={`${expanded ? "w-80" : "w-[60px]"} min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col border-r border-[var(--border-default)] transition-all duration-200`}>
      {/* Logo */}
<div className={`px-5 pt-6 pb-4 border-b border-[var(--border-default)] ${expanded ? "" : "text-center"}`}>
  {expanded ? (
  <div className="flex items-center gap-3">
    <img src="/logo.png" alt="AssetFlow" className="w-8 h-8 rounded-lg" />
    <h1 className="text-xl font-bold tracking-tight">AssetFlow</h1>
  </div>
) : (
  <img src="/logo.png" alt="AssetFlow" className="w-7 h-7 rounded-lg mx-auto" />
)}
</div>

      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mx-3 mt-3 mb-1 p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors text-xs self-end"
      >
        {expanded ? "◀" : "▶"}
      </button>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {navItems.map((item, i) => {
          if (item.section === "divider") {
            return <div key={i} className="my-3 border-t border-[var(--border-default)]" />;
          }
          if (item.section === "header") {
            if (!expanded) return null;
            return (
              <p key={i} className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] px-3 pt-2 pb-1">
                {item.label}
              </p>
            );
          }

          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href!));
          const IconComponent = item.icon as React.ComponentType<{ className?: string }>;

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex items-center rounded-xl transition-all duration-200 ${
                expanded ? "px-3 py-2.5" : "justify-center px-0 py-2.5 w-10 mx-auto"
              } ${
                isActive
                  ? "bg-white/5 border border-white/10 text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              }`}
            >
               <IconComponent className="w-5 h-5 flex-shrink-0" />
              {expanded && (
                <div className="ml-3 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  {item.desc && (
                    <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{item.desc}</p>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}