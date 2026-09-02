"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchIcons } from "@/lib/platform/icons";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics/tracker";
import { Users, Building2, FileText, Receipt, MessageSquare, CheckSquare, TrendingDown, Search } from "lucide-react";

type SearchResult = {
  type: string;
  id?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
  icon?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const iconMap: Record<string, any> = {
  Users, Building2, FileText, Receipt, MessageSquare, CheckSquare, TrendingDown, Search
};

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchTerm.length < 2) { setResults([]); setLoading(false); setIntent(""); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/command?q=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      setResults(data.results || []);
      setIntent(data.intent || "");
      setLoading(false);
      trackEvent(AnalyticsEvents.SEARCH, undefined, { query: searchTerm, resultsCount: data.results?.length || 0, intent: data.intent });
    }, 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSelectedIndex(0);
      setResults([]);
      setIntent("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, results.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)); return; }
      if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        const item = results[selectedIndex];
        trackEvent(AnalyticsEvents.SEARCH, undefined, { query: searchTerm, resultClicked: item.title, type: item.type });
        router.push(item.href);
        onClose();
        return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, router, onClose, searchTerm]);

  useEffect(() => { setSelectedIndex(0); }, [searchTerm]);

  if (!open) return null;

  const typeLabels: Record<string, string> = {
    tenant: "Tenant", property: "Property", lease: "Lease", invoice: "Invoice",
    statement: "Statement", communication: "Communication", task: "Task",
    command: "Command", insight: "Insight",
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[12vh]" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-default)]">
          <Search className="w-5 h-5 text-[var(--text-muted)]" />
          <input ref={inputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tenants, properties, leases, statements, invoices..." className="flex-1 bg-transparent text-[var(--text-primary)] text-sm outline-none placeholder:text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-1 rounded-lg">ESC</span>
        </div>

        {intent && (
          <div className="px-5 py-2 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
            <p className="text-xs text-[var(--text-muted)]">
              {intent === "expiring_leases" && "Showing leases expiring soon"}
              {intent === "arrears" && "Showing tenants with outstanding balances"}
              {intent === "Vacant" && "Showing vacant properties"}
              {intent === "invoices" && "Showing matching invoices"}
              {intent === "statements" && "Showing matching statements"}
            </p>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto p-2">
          {loading && <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">Searching across your portfolio...</p>}
          {!loading && results.length === 0 && searchTerm.length >= 2 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">No results found for "{searchTerm}"</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Try a different search term</p>
            </div>
          )}
          {!loading && results.length === 0 && searchTerm.length < 2 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">Search anything across your portfolio</p>
              <div className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
                <p>Try: "leases expiring in 90 days"</p>
                <p>Try: "tenants with arrears"</p>
                <p>Try: "Shoprite" or "Sandton"</p>
              </div>
            </div>
          )}
          {results.map((item, i) => {
            const Icon = iconMap[item.icon || "Search"] || Search;
            return (
              <button
                key={`${item.type}-${item.id || item.title}`}
                onClick={() => {
                  trackEvent(AnalyticsEvents.SEARCH, undefined, { query: searchTerm, resultClicked: item.title, type: item.type });
                  router.push(item.href); onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors text-left ${
                  i === selectedIndex ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  {item.subtitle && <p className="text-xs text-[var(--text-muted)] truncate">{item.subtitle}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.meta && <span className="text-xs text-[var(--text-muted)]">{item.meta}</span>}
                  <span className="text-[10px] text-[var(--text-muted)] uppercase bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full">{typeLabels[item.type] || item.type}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-default)] flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>↑↓ Navigate</span><span>↵ Open</span><span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}
