"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCommandPalette } from "@/lib/platform/CommandPaletteContext";
import { supabase } from "@/lib/supabase";
import { 
  Home, Receipt, Landmark, MessageSquare, CheckSquare, ClipboardCheck, Wrench, PenLine,
  Building2, Users, Briefcase, Calendar, Search, Pin, PinOff, FileText, BarChart3
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
  const sidebarRef = useRef<HTMLElement>(null);

  const isExpanded = pinned || hovered;

  // Load attention counts
  useEffect(() => {
    async function loadCounts() {
      const { count: unallocated } = await supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("allocation_status", "unallocated");
      const { count: expiring } = await supabase.from("leases").select("id", { count: "exact", head: true }).eq("lease_status", "Active").lte("lease_end_date", new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
      const { count: pendingTasks } = await supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "completed");
      const { count: unreadComms } = await supabase.from("communications").select("id", { count: "exact", head: true }).eq("status", "sent");
      setCounts({
        revenue: (unallocated || 0),
        cashbook: (unallocated || 0),
        tasks: (pendingTasks || 0),
        communications: (unreadComms || 0),
        tenants: (expiring || 0),
      });
    }
    loadCounts();
  }, [pathname]);

  const operationsItems: NavItem[] = [
    { label: "Revenue Ops", href: "/financials/revenue", icon: Receipt, desc: "Billing · Statements · Utilities", count: counts.revenue },
    { label: "Cash Book", href: "/financials/cash-book", icon: Landmark, desc: "Banking · Reconciliation · Allocation", count: counts.cashbook },
    { label: 'Payment Hub', href: '/treasury', icon: Landmark, desc: 'Treasury · Batches' },
    { label: 'Imports', href: '/financials/imports', icon: Landmark, desc: 'Bank Import · Presets' },
    { label: "Commercial Leasing", href: "/leasing", icon: FileText, desc: "Opportunities · Brokers · Deals" },
    { label: "Communications", href: "/communications", icon: MessageSquare, desc: "Email · WhatsApp · Statements", count: counts.communications },
    { label: "Tasks", href: "/tasks", icon: CheckSquare, desc: "Workflows · Approvals · Follow Ups", count: counts.tasks },
    { label: "Maintenance", href: "/maintenance", icon: Wrench, desc: "Issues · Work Orders · Suppliers" },
    { label: "Inspections", href: "/inspections", icon: ClipboardCheck, desc: "Routine · Compliance · Reports" },
    { label: "Utilities", href: "/utilities", icon: Zap, desc: "Meters · Recoveries · Analysis" },
  ];

  const portfolioItems: NavItem[] = [
    { label: "Properties", href: "/properties", icon: Building2, desc: "Buildings · Occupancy · Units" },
    { label: "Tenants", href: "/tenants", icon: Users, desc: "Accounts · Statements · Communications", count: counts.tenants },
    { label: "Suppliers", href: "/suppliers", icon: Briefcase, desc: "Invoices · Payments · Contracts" },
  ];

  const systemItems: NavItem[] = [
    { label: "Periods", href: "/financials/periods", icon: Calendar, desc: "Billing Cycles · Governance" },
    { label: "Financials", href: "/financials", icon: BarChart3, desc: "GL · Statements · VAT" },
    { label: "Signatures", href: "/signatures", icon: PenLine, desc: "Document Signing" },
    { label: "Reports", href: "/reports", icon: BarChart3, desc: "Rent Roll · Arrears · Portfolio" },
  ];

  function NavItemRow({ item, showLabel }: { item: NavItem; showLabel: boolean }) {
  const isActive = pathname === item.href;
    const Icon = item.icon;

    return (
      <Link
        href={item.href}
        className={`flex items-center h-10 rounded-2xl transition-all duration-200 group relative ${
          showLabel ? "px-3" : "justify-center px-0 w-10 mx-auto"
        } ${
          isActive
            ? "bg-white/5 border border-white/10 text-white"
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
      >
        <div className="relative flex-shrink-0">
          <Icon className="w-5 h-5" />
          {(item.count ?? 0) > 0 && (
  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500" />
)}
        </div>
        {showLabel && (
          <div className="ml-3 min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate">{item.label}</p>
              {(item.count ?? 0) > 0 && (
  <span className="text-[10px] text-amber-400 font-medium ml-2">{item.count}</span>
)}
            </div>
            {item.desc && <p className="text-[10px] text-zinc-500 truncate mt-0.5">{item.desc}</p>}
          </div>
        )}
        {!showLabel && (
          <div className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-xl border border-zinc-800 bg-black px-3 py-2 text-xs shadow-2xl opacity-0 transition-all duration-200 group-hover:opacity-100">
            <p className="font-medium text-white">{item.label}</p>
            {item.desc && <p className="text-zinc-500 mt-0.5">{item.desc}</p>}
            {item.count && item.count > 0 && <p className="text-amber-400 mt-0.5">{item.count} attention items</p>}
          </div>
        )}
      </Link>
    );
  }

  return (
    <aside
      ref={sidebarRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${isExpanded ? "w-80" : "w-[72px]"} min-h-screen bg-[var(--bg-primary)] text-white flex flex-col relative z-50 border-r border-[var(--border-default)] transition-all duration-200`}
    >
      {/* Logo */}
      <div className={`px-5 pt-6 pb-4 border-b border-[var(--border-default)] ${isExpanded ? "" : "text-center"}`}>
        {isExpanded ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="AssetFlow" className="w-7 h-7 rounded-lg" />
              <h1 className="text-lg font-bold tracking-tight">AssetFlow</h1>
            </div>
            <button onClick={() => setPinned(!pinned)} className={`text-xs p-1.5 rounded-lg transition-colors ${pinned ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`} title={pinned ? "Unpin" : "Pin"}>
  {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
</button>
          </div>
        ) : (
          <img src="/logo.png" alt="AssetFlow" className="w-7 h-7 rounded-lg mx-auto" />
        )}
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={open}
          className={`w-full flex items-center rounded-2xl border border-zinc-800 bg-black/40 text-sm text-zinc-500 transition-colors hover:border-zinc-700 ${
            isExpanded ? "px-4 py-2.5 gap-3" : "justify-center h-10 w-10 mx-auto px-0"
          }`}
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          {isExpanded && <span className="flex-1 text-left">Search anything...</span>}
        </button>
      </div>

      {/* Home */}
      <div className="px-3 py-1">
        <Link
          href="/app"
          className={`flex items-center h-10 rounded-2xl transition-all duration-200 ${
            isExpanded ? "px-3" : "justify-center px-0 w-10 mx-auto"
          } ${pathname === "/" ? "bg-white/5 border border-white/10 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}
        >
          <Home className="w-5 h-5 flex-shrink-0" />
          {isExpanded && <span className="ml-3 text-sm font-medium">Morning Brief</span>}
          {!isExpanded && (
            <div className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-xl border border-zinc-800 bg-black px-3 py-2 text-xs shadow-2xl opacity-0 transition-all duration-200 group-hover:opacity-100">
              <p className="font-medium text-white">Morning Brief</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* Operations */}
        <div>
          {isExpanded && <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-1">Operations</p>}
          <div className="space-y-1">
            {operationsItems.map(item => <NavItemRow key={item.href} item={item} showLabel={isExpanded} />)}
          </div>
        </div>

        {/* Portfolio */}
        <div>
          {isExpanded && <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-1">Portfolio</p>}
          <div className="space-y-1">
            {portfolioItems.map(item => <NavItemRow key={item.href} item={item} showLabel={isExpanded} />)}
          </div>
        </div>

        {/* System */}
        <div>
          {isExpanded && <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-1">System</p>}
          <div className="space-y-1">
            {systemItems.map(item => <NavItemRow key={item.href} item={item} showLabel={isExpanded} />)}
          </div>
        </div>
      </div>
    </aside>
  );
}
