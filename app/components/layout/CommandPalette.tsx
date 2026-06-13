"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getNavigationForRole } from "@/lib/rbac/navigation";
import { usePlatform } from "@/app/context/PlatformContext";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const { activeRole } = usePlatform();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navItems = getNavigationForRole(activeRole.id as any);

  const results = searchTerm
    ? navItems.filter(i => i.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : navItems.slice(0, 8);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (results[selectedIndex]) {
          router.push(results[selectedIndex].href);
          onClose();
        }
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, router, onClose]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  if (!open) return null;

  const icons: Record<string, string> = {
    home: "⌂", cashbook: "◧", revenue: "◨", leases: "◫", maintenance: "⚙",
    properties: "▣", tenants: "◩", suppliers: "◎", documents: "▤",
    import: "↓", reports: "◪", settings: "⚒",
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <span className="text-zinc-500 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
          />
          <span className="text-xs text-zinc-600 bg-zinc-900 px-2 py-1 rounded-lg">ESC</span>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500 text-center">No results found</p>
          ) : (
            results.map((item, i) => (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors text-left ${
                  i === selectedIndex
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <span className="text-lg w-8 text-center">{icons[item.icon as string] || "•"}</span>
                <span className="flex-1">{item.label}</span>
                <span className="text-xs text-zinc-600">{item.href}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center gap-4 text-xs text-zinc-600">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}