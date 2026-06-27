"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { CommandPalette } from "./layout/CommandPalette";
import { useCommandPalette } from "@/lib/platform/CommandPaletteContext";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAttention, setShowAttention] = useState(false);
  const [attentionCount, setAttentionCount] = useState(0);
  const { isOpen, open, close } = useCommandPalette();

  if (pathname === '/login' || pathname === '/signup' || pathname === '/landing') return null;

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setEmail(user.email);
    }
    getUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) setEmail(session.user.email);
      else setEmail("");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadAttention() {
      const { count: unallocated } = await supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("allocation_status", "unallocated");
      const { count: expiring } = await supabase.from("leases").select("id", { count: "exact", head: true }).eq("lease_status", "Active").lte("lease_end_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
      setAttentionCount((unallocated || 0) + (expiring || 0));
    }
    loadAttention();
  }, [pathname]);
  useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      open();
    }
  }
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [open]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmail("");
    setShowDropdown(false);
    router.push('/login');
  };

  return (
    <div className="bg-[var(--bg-primary)] border-b border-[var(--border-default)] px-6 py-3 flex items-center justify-between relative z-50">
      <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">AssetFlow</span>

      <div className="flex-1 max-w-xl mx-6">
        <button onClick={open} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-muted)] text-left hover:border-[var(--border-hover)] transition-colors">
          Search tenants, properties, leases, statements, invoices, transactions...
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button onClick={() => setShowAttention(!showAttention)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">Attention ({attentionCount})</button>
          {showAttention && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl py-2 overflow-hidden">
              <div className="px-4 py-2">
                <button onClick={() => router.push('/financials/cash-book')} className="w-full text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] px-2 py-1.5 rounded-lg transition-colors">{attentionCount} Unallocated Receipts</button>
                <button onClick={() => router.push('/tenants')} className="w-full text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] px-2 py-1.5 rounded-lg transition-colors">4 Leases Expiring</button>
                <button onClick={() => router.push('/financials/revenue')} className="w-full text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] px-2 py-1.5 rounded-lg transition-colors">3 Billing Exceptions</button>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <span>{email ? email.split('@')[0] : "User"}</span><span>▼</span>
          </button>
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg py-1 overflow-hidden">
              <button onClick={() => router.push('/settings')} className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">Profile</button>
              <button className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">Theme</button>
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
