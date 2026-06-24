"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchIcons } from "@/lib/platform/icons";

type SearchResult = {
  type: string;
  id?: string;
  label: string;
  sublabel?: string;
  href: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch results from search API
  useEffect(() => {
    if (searchTerm.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/intelligence/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      setResults(data.results || []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSelectedIndex(0);
      setResults([]);
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
        router.push(item.href);
        onClose();
        return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, router, onClose]);

  useEffect(() => { setSelectedIndex(0); }, [searchTerm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-default)]">
          <span className="text-[var(--text-muted)]">
            <searchIcons.cashbook className="w-5 h-5" />
          </span>
          <input ref={inputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tenants, properties, leases, statements..." className="flex-1 bg-transparent text-[var(--text-primary)] text-sm outline-none placeholder:text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-1 rounded-lg">ESC</span>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">Searching...</p>
          )}
          {!loading && results.length === 0 && searchTerm.length >= 2 && (
            <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">No results found</p>
          )}
          {!loading && results.length === 0 && searchTerm.length < 2 && (
            <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">Type to search across your portfolio</p>
          )}
          {results.map((item, i) => {
            const Icon = searchIcons[item.type] || searchIcons.cashbook;
            return (
              <button
                key={`${item.type}-${item.id || item.label}`}
                onClick={() => { router.push(item.href); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors text-left ${
                  i === selectedIndex ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.label}</p>
                  {item.sublabel && <p className="text-xs text-[var(--text-muted)] truncate">{item.sublabel}</p>}
                </div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase flex-shrink-0">{item.type}</span>
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-default)] flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}
