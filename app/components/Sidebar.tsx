"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCommandPalette } from "@/lib/platform/CommandPaletteContext";
import { supabase } from "@/lib/supabase";
import { 
  Home, Receipt, Landmark, FileText, MessageSquare, CheckSquare,
  Building2, Users, Briefcase, Calendar, BarChart3, Search
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: any;
  desc?: string;
  count?: number;
};

export default function Sidebar() {
  const pathname = usePathname();
  const { open } = useCommandPalette();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const isExpanded = pinned || hovered;

  useEffect(() => {
    async function loadCounts() {
      const { count: unallocated } = await supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("allocation_status", "unallocated");
      const { count: expiring } = await supabase.from("leases").select("id", { count: "exact", head: true }).eq("lease_status", "Active").lte("lease_end_date", new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
      const { count: pendingTasks } = await supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "completed");
      setCounts({
        revenue: (unallocated || 0),
        cashbook: (unallocated || 0),
        tasks: (pendingTasks || 0),
        tenants: (expiring || 0),
      });
    }
    loadCounts();
  }, [pathname]);

  const operationsItems: NavItem[] = [
    { label: "Revenue Ops", href: "/financials/revenue", icon: Receipt, desc: "Billing · Statements", count: counts.revenue },
    { label: "Cash Book", href: "/financials/cash-book", icon: Landmark, desc: "Banking · Reconciliation", count: counts.cashbook },
    { label: "Leasing", href: "/leasing", icon: FileText, desc: "Opportunities · Brokers" },
    { label: "Communications", href: "/communications", icon: MessageSquare, desc: "Email · WhatsApp" },
    { label: "Tasks", href: "/tasks", icon: CheckSquare, desc: "Workflows · Approvals", count: counts.tasks },
  ];

  const portfolioItems: NavItem[] = [
    { label: "Properties", href: "/properties", icon: Building2, desc: "Occupancy · Financials" },
    { label: "Tenants", href: "/tenants", icon: Users, desc: "Accounts · Statements", count: counts.tenants },
    { label: "Suppliers", href: "/suppliers", icon: Briefcase, desc: "Invoices · Payments" },
  ];

  const systemItems: NavItem[] = [
    { label: "Periods", href: "/financials/periods", icon: Calendar, desc: "Billing · Governance" },
    { label: "Reports", href: "/reports", icon: BarChart3, desc: "Rent Roll · Portfolio" },
  ];

  function NavItemRow({ item, showLabel }: { item: NavItem; showLabel: boolean }) {
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
    const Icon = item.icon;

    return (
      <Link
        href={item.href}
        className={`flex items-center h-9 rounded-xl transition-all duration-200 group relative ${
          showLabel ? "px-3" : "justify-center px-0 w-9 mx-auto"
        } ${
          isActive
            ? "bg-white/[0.06] text-white"
            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
        }`}
      >
        <div className="relative flex-shrink-0">
          <Icon className="w-4.5 h-4.5" strokeWidth={1.5} />
          {(item.count ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
          )}
        </div>
        {showLabel && (
          <div className="ml-3 min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-light truncate">{item.label}</p>
              {(item.count ?? 0) > 0 && (
                <span className="text-[10px] text-amber-400 font-light ml-2">{item.count}</span>
              )}
            </div>
            {item.desc && <p className="text-[10px] text-zinc-600 truncate mt-0.5 font-light">{item.desc}</p>}
          </div>
        )}
        {!showLabel && (item.count ?? 0) > 0 && (
          <span className="absolute top-1 right-1 text-[9px] text-amber-400 font-medium">{item.count}</span>
        )}
      </Link>
    );
  }

  function NavSection({ title, items, showLabel }: { title: string; items: NavItem[]; showLabel: boolean }) {
    return (
      <div className="space-y-1">
        {showLabel && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-700 font-medium px-3 pt-4 pb-2 first:pt-0">
            {title}
          </p>
        )}
        {items.map(item => (
          <NavItemRow key={item.href} item={item} showLabel={showLabel} />
        ))}
      </div>
    );
  }

  return (
    <aside
      className="fixed left-0 top-0 h-full z-40 flex flex-col bg-black border-r border-white/[0.04] transition-all duration-200"
      style={{ width: isExpanded ? 240 : 60 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center h-14 px-3 border-b border-white/[0.04]">
        <span className="text-sm font-medium tracking-tight text-white">AssetFlow</span>
      </Link>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-6">
        {/* Home */}
        <NavItemRow item={{ label: "Morning Brief", href: "/", icon: Home }} showLabel={isExpanded} />
        
        <NavSection title="Operations" items={operationsItems} showLabel={isExpanded} />
        <NavSection title="Portfolio" items={portfolioItems} showLabel={isExpanded} />
        <NavSection title="System" items={systemItems} showLabel={isExpanded} />
      </div>

      {/* Search */}
      <div className="px-2 pb-3">
        <button
          onClick={open}
          className={`flex items-center rounded-xl transition-all duration-200 text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300 ${
            isExpanded ? "h-9 px-3 w-full" : "justify-center px-0 w-9 h-9 mx-auto"
          }`}
        >
          <Search className="w-4.5 h-4.5" strokeWidth={1.5} />
          {isExpanded && <span className="ml-3 text-[13px] font-light">Search</span>}
        </button>
      </div>

      {/* Pin button */}
      <div className="px-2 pb-4">
        <button
          onClick={() => setPinned(!pinned)}
          className={`flex items-center rounded-xl transition-all duration-200 ${
            isExpanded ? "h-9 px-3 w-full text-zinc-500 hover:bg-white/[0.03]" : "justify-center px-0 w-9 h-9 mx-auto text-zinc-600 hover:text-zinc-400"
          }`}
        >
          <span className="text-[10px] font-light">{isExpanded ? (pinned ? "Unpin" : "Pin open") : " "}</span>
        </button>
      </div>
    </aside>
  );
}
