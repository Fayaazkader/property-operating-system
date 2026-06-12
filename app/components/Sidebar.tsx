"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getNavigationForRole } from "@/lib/rbac/navigation";
import { usePlatform } from "../context/PlatformContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { activeRole } = usePlatform();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  const navItems = getNavigationForRole(activeRole.id as any);
  const primaryItems = navItems.filter(i => (i as any).zone === "primary");
  const secondaryItems = navItems.filter(i => (i as any).zone === "secondary");
  const tertiaryItems = navItems.filter(i => (i as any).zone === "tertiary");

  // Search filter
  const searchResults = searchTerm
    ? navItems.filter(i => i.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // Click outside search
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function NavItem({ item, collapsed: col }: { item: any; collapsed: boolean }) {
    const isActive = pathname === item.href;
    const icons: Record<string, string> = {
      home: "⌂", cashbook: "◧", revenue: "◨", leases: "◫", maintenance: "⚙",
      properties: "▣", tenants: "◩", suppliers: "◎", documents: "▤",
      import: "↓", reports: "◪", settings: "⚒",
    };

    return (
      <Link
        href={item.href}
        className={`flex items-center h-10 rounded-2xl transition-all duration-200 group relative ${
          col ? "justify-center px-0 w-11 mx-auto" : "px-3"
        } ${
          isActive
            ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
      >
        <span className="text-lg flex-shrink-0">{icons[item.icon] || "•"}</span>
        {!col && <span className="ml-3 text-sm font-medium truncate">{item.label}</span>}
        {col && (
          <div className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-xl border border-zinc-800 bg-black px-3 py-2 text-xs font-medium text-white opacity-0 shadow-2xl transition-all duration-200 group-hover:opacity-100">
            {item.label}
          </div>
        )}
      </Link>
    );
  }

  return (
    <aside
      className={`${collapsed ? "w-[72px]" : "w-60"} min-h-screen bg-black text-white flex flex-col relative z-50 border-r border-zinc-800 transition-all duration-300`}
    >
      {/* Logo */}
      <div className={`px-5 pt-6 pb-4 border-b border-zinc-800 ${collapsed ? "text-center" : ""}`}>
        {collapsed ? (
          <span className="text-xl font-black tracking-tight">AF</span>
        ) : (
          <h1 className="text-2xl font-black tracking-tight">AssetFlow</h1>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pt-2 pb-1" ref={searchRef}>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className={`w-full flex items-center rounded-2xl border border-zinc-800 bg-black/40 text-sm text-zinc-500 transition-colors hover:border-zinc-700 ${
            collapsed ? "justify-center h-10 w-10 mx-auto px-0" : "px-4 py-2.5 gap-3"
          }`}
        >
          <span className="flex-shrink-0">🔍</span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search...</span>
              <span className="text-xs text-zinc-700">⌘K</span>
            </>
          )}
        </button>
        {searchOpen && (
          <div className={`absolute ${collapsed ? "left-14" : "left-3 right-3"} top-20 z-50 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden`}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search pages..."
              autoFocus
              className="w-full bg-transparent px-4 py-3 text-sm text-white outline-none border-b border-zinc-800"
            />
            <div className="max-h-48 overflow-y-auto">
              {searchResults.length === 0 && searchTerm ? (
                <p className="px-4 py-3 text-sm text-zinc-500">No results</p>
              ) : (
                searchResults.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => { setSearchOpen(false); setSearchTerm(""); }}
                    className="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Zones */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Zone 1 — Primary */}
        {primaryItems.length > 0 && (
          <div>
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-1">Workspace</p>
            )}
            <div className="space-y-1">
              {primaryItems.map(item => (
                <NavItem key={item.href} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        )}

        {/* Zone 2 — Secondary */}
        {secondaryItems.length > 0 && (
          <div>
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-2">Management</p>
            )}
            <div className="space-y-1">
              {secondaryItems.map(item => (
                <NavItem key={item.href} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        )}

        {/* Zone 3 — Tertiary */}
        {tertiaryItems.length > 0 && (
          <div>
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-2">Tools</p>
            )}
            <div className="space-y-1">
              {tertiaryItems.map(item => (
                <NavItem key={item.href} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <div className="px-3 py-3 border-t border-zinc-800">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>
    </aside>
  );
}