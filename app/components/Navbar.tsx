"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { CommandPalette } from "./layout/CommandPalette";
import { useCommandPalette } from "@/lib/platform/CommandPaletteContext";
import { Bell } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAttention, setShowAttention] = useState(false);
  const [attentionCount, setAttentionCount] = useState(0);
  const [attentionItems, setAttentionItems] = useState<{ label: string; href: string }[]>([]);
  const [stmtPeriod, setStmtPeriod] = useState("");
  const [finPeriod, setFinPeriod] = useState("");
  const { isOpen, open, close } = useCommandPalette();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const attentionRef = useRef<HTMLDivElement>(null);

  if (pathname === '/login' || pathname === '/signup' || pathname === '/landing') return null;

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
        if (profile?.display_name) setDisplayName(profile.display_name);
      }
    }
    getUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", session.user.id).single();
        if (profile?.display_name) setDisplayName(profile.display_name);
      } else {
        setEmail("");
        setDisplayName("");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadAttention() {
      const { count: unallocated } = await supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("allocation_status", "unallocated");
      const { count: expiring } = await supabase.from("leases").select("id", { count: "exact", head: true }).eq("lease_status", "Active").lte("lease_end_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
      const items: { label: string; href: string }[] = [];
      if (unallocated && unallocated > 0) items.push({ label: `${unallocated} Unallocated Receipts`, href: "/financials/cash-book" });
      if (expiring && expiring > 0) items.push({ label: `${expiring} Leases Expiring`, href: "/tenants" });
      setAttentionItems(items);
      setAttentionCount((unallocated || 0) + (expiring || 0));
    }
    loadAttention();
    async function loadPeriods() {
      const { data: stmt } = await supabase.from("statement_periods").select("period_name").eq("status", "open").order("period_start", { ascending: false }).limit(1).single();
      if (stmt) setStmtPeriod(stmt.period_name);
      const { data: fin } = await supabase.from("financial_periods").select("period_name").eq("status", "open").order("period_start", { ascending: false }).limit(1).single();
      if (fin) setFinPeriod(fin.period_name);
    }
    loadPeriods();
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); open(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
      if (attentionRef.current && !attentionRef.current.contains(e.target as Node)) setShowAttention(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmail("");
    setDisplayName("");
    setShowDropdown(false);
    router.push('/login');
  };

  return (
    <div className="bg-[var(--bg-primary)] border-b border-[var(--border-default)] px-6 py-3 flex items-center justify-between relative z-50">
      {/* Center: Search */}
      <div className="flex-1 max-w-xl">
        <button onClick={open} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-muted)] text-left hover:border-[var(--border-hover)] transition-colors flex items-center gap-3">
          <span className="flex-1">Search anything...</span>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-lg">⌘K</span>
        </button>
      </div>

      {/* Right: Periods + Attention + User */}
      <div className="flex items-center gap-4 ml-6">
        {stmtPeriod && (
          <span className="rounded-full border border-[var(--border-default)] px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            STMT {stmtPeriod}
          </span>
        )}
        {finPeriod && (
          <span className="rounded-full border border-[var(--border-default)] px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            FIN {finPeriod}
          </span>
        )}

        <div className="relative" ref={attentionRef}>
          <button onClick={() => setShowAttention(!showAttention)} className="relative text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <Bell className="w-5 h-5" />
            {attentionCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">{attentionCount}</span>
            )}
          </button>
          {showAttention && attentionItems.length > 0 && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl py-2 overflow-hidden">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] px-4 py-2">Attention</p>
              {attentionItems.map((item, i) => (
                <button key={i} onClick={() => { router.push(item.href); setShowAttention(false); }} className="w-full text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] px-4 py-2 transition-colors">{item.label}</button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <div className="w-7 h-7 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-xs font-bold text-[var(--bg-primary)]">
              {displayName ? displayName.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : "U")}
            </div>
            <span className="hidden md:inline">{displayName || (email ? email.split('@')[0] : "User")}</span>
          </button>
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg py-1 overflow-hidden">
              <button onClick={() => router.push('/settings')} className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">Profile</button>
              <button onClick={() => router.push('/settings')} className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">Settings</button>
              <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/5 transition-colors border-t border-[var(--border-default)]">Logout</button>
            </div>
          )}
        </div>
      </div>

      <CommandPalette open={isOpen} onClose={close} />
    </div>
  );
}
