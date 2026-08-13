"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { CommandPalette } from "./layout/CommandPalette";
import { useCommandPalette } from "@/lib/platform/CommandPaletteContext";
import { Bell, MessageSquare } from "lucide-react";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics/tracker";
import { useEntityContext } from '@/app/context/EntityContext';
import { ChevronDown } from 'lucide-react';

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
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const { isOpen, open, close } = useCommandPalette();
  const { availableEntities, activeEntityId, setActiveEntityId } = useEntityContext();
const [showEntitySelector, setShowEntitySelector] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const attentionRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState("love");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  if (pathname === '/login' || pathname === '/signup' || pathname === '/landing') return null;

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
        const { data: profile } = await supabase.from("profiles").select("display_name, platform_role").eq("id", user.id).single();
if (profile?.display_name) setDisplayName(profile.display_name);
if (profile?.platform_role === 'platform_admin') setIsPlatformAdmin(true);
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
      if (!activeEntityId) {
        setStmtPeriod('');
        setFinPeriod('');
        return;
      }
      const { data: stmt } = await supabase.from("financial_periods").select("period_name").eq("entity_id", activeEntityId).eq("period_type", "statement").eq("status", "open").order("period_start", { ascending: false }).limit(1).single();
      if (stmt) setStmtPeriod(stmt.period_name);
      const { data: fin } = await supabase.from("financial_periods").select("period_name").eq("entity_id", activeEntityId).eq("period_type", "financial").eq("status", "open").order("period_start", { ascending: false }).limit(1).single();
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
    if (feedbackRef.current && !feedbackRef.current.contains(e.target as Node)) setShowFeedback(false);
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
      <div className="flex-1 max-w-xl">
        <button onClick={open} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-muted)] text-left hover:border-[var(--border-hover)] transition-colors flex items-center gap-3">
          <span className="flex-1">Search anything...</span>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-lg">⌘K</span>
        </button>
      </div>

      <div className="flex items-center gap-4 ml-6">
                      {/* Entity Selector — clean dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowEntitySelector(!showEntitySelector)} 
            className="flex items-center gap-1.5 text-sm text-[var(--text-primary)] hover:opacity-80 transition-opacity"
          >
            {activeEntityId 
              ? availableEntities.find(e => e.entity_id === activeEntityId)?.entity_name || 'Entity'
              : 'Portfolio'
            }
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          
          {showEntitySelector && (
            <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl py-2 overflow-hidden z-50">
              <button 
                onClick={() => { setActiveEntityId(null); setShowEntitySelector(false); }} 
                className={`w-full text-left text-sm px-4 py-2 transition-colors ${!activeEntityId ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}
              >
                Portfolio (All)
              </button>
              
              {availableEntities.map(entity => (
                <button 
                  key={entity.entity_id}
                  onClick={() => { setActiveEntityId(entity.entity_id); setShowEntitySelector(false); }} 
                  className={`w-full text-left text-sm px-4 py-2 transition-colors ${activeEntityId === entity.entity_id ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}
                >
                  {entity.entity_name}
                </button>
              ))}
            </div>
          )}
        </div>
        {stmtPeriod && (
          <span className="rounded-full border border-[var(--border-default)] px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">STMT {stmtPeriod}</span>
        )}
        {finPeriod && (
          <span className="rounded-full border border-[var(--border-default)] px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">FIN {finPeriod}</span>
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

        <div className="relative" ref={feedbackRef}>
  <button onClick={() => setShowFeedback(!showFeedback)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Send Feedback">
            <MessageSquare className="w-5 h-5" />
          </button>
          {showFeedback && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl p-4 overflow-hidden z-50">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">Send Feedback</p>
              {feedbackSubmitted ? (
                <p className="text-sm text-emerald-400 text-center py-4">Thank you! Feedback submitted.</p>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    {[{ key: "love", label: "❤️ Love" }, { key: "frustration", label: "😤 Frustrated" }, { key: "missing_feature", label: "💡 Missing" }].map(f => (
                      <button key={f.key} onClick={() => setFeedbackType(f.key)} className={`rounded-full px-3 py-1 text-xs transition-colors ${feedbackType === f.key ? 'bg-white text-black' : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'}`}>{f.label}</button>
                    ))}
                  </div>
                  <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={2} placeholder="What's on your mind?" className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] resize-none placeholder:text-[var(--text-muted)] mb-3" />
                  <button onClick={async () => {
                    if (!feedbackText.trim()) return;
                    await supabase.from("feedback_items").insert({ category: feedbackType, title: feedbackText, status: "new", page: pathname });
                    trackEvent(AnalyticsEvents.FEEDBACK_SUBMITTED, "feedback", { category: feedbackType, page: pathname });
                    setFeedbackSubmitted(true);
                    setTimeout(() => { setShowFeedback(false); setFeedbackSubmitted(false); setFeedbackText(""); }, 2000);
                  }} className="w-full rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] py-2 text-xs font-semibold hover:opacity-90 transition-opacity">Submit</button>
                </>
              )}
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
              {isPlatformAdmin && (
  <button onClick={() => router.push('/admin')} className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors">Admin</button>
)}
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
