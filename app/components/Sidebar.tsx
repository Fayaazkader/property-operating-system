"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getNavigationForRole } from "@/lib/rbac/navigation";
import { usePlatform } from "../context/PlatformContext";
import { CommandPalette } from "./layout/CommandPalette";

export default function Sidebar() {
  const pathname = usePathname();
  const { activeRole } = usePlatform();
  const [collapsed, setCollapsed] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const navItems = getNavigationForRole(activeRole.id as any);
  const primaryItems = navItems.filter(i => (i as any).zone === "primary");
  const secondaryItems = navItems.filter(i => (i as any).zone === "secondary");
  const tertiaryItems = navItems.filter(i => (i as any).zone === "tertiary");

  const isExpanded = pinned || hovered || !collapsed;

  // Auto-collapse after navigation (if not pinned)
  useEffect(() => {
    if (!pinned) {
      setCollapsed(true);
    }
  }, [pathname]);

  // Keyboard shortcut
  useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCommandPaletteOpen(true);
    }
  }
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, []);

  function NavItem({ item, showLabel }: { item: any; showLabel: boolean }) {
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
          showLabel ? "px-3" : "justify-center px-0 w-10 mx-auto"
        } ${
          isActive
            ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
        }`}
      >
        <span className="text-lg flex-shrink-0">{icons[item.icon] || "•"}</span>
        {showLabel && <span className="ml-3 text-sm font-medium truncate">{item.label}</span>}
        {!showLabel && (
          <div className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-xl border border-zinc-800 bg-black px-3 py-2 text-xs font-medium text-white opacity-0 shadow-2xl transition-all duration-200 group-hover:opacity-100">
            {item.label}
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
      className={`${isExpanded ? "w-60" : "w-[72px]"} min-h-screen bg-black text-white flex flex-col relative z-50 border-r border-zinc-800 transition-all duration-300`}
    >
      {/* Logo + Pin */}
      <div className={`px-5 pt-6 pb-4 border-b border-zinc-800 flex items-center ${isExpanded ? "justify-between" : "justify-center"}`}>
        {isExpanded ? (
          <h1 className="text-2xl font-black tracking-tight">AssetFlow</h1>
        ) : (
          <span className="text-xl font-black tracking-tight">AF</span>
        )}
        {isExpanded && (
          <button
            onClick={() => setPinned(!pinned)}
            className={`text-xs p-1.5 rounded-lg transition-colors ${
              pinned ? "bg-white text-black" : "text-zinc-500 hover:text-white hover:bg-zinc-900"
            }`}
            title={pinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            📌
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pt-2 pb-1">
  <button
    onClick={() => setCommandPaletteOpen(true)}
    className={`w-full flex items-center rounded-2xl border border-zinc-800 bg-black/40 text-sm text-zinc-500 transition-colors hover:border-zinc-700 ${
      isExpanded ? "px-4 py-2.5 gap-3" : "justify-center h-10 w-10 mx-auto px-0"
    }`}
  >
    <span className="flex-shrink-0">🔍</span>
    {isExpanded && (
      <>
        <span className="flex-1 text-left">Search...</span>
        <span className="text-xs text-zinc-700">⌘K</span>
      </>
    )}
  </button>
</div>

      {/* Navigation Zones */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {primaryItems.length > 0 && (
          <div>
            {isExpanded && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-1">Workspace</p>
            )}
            <div className="space-y-1">
              {primaryItems.map(item => (
                <NavItem key={item.href} item={item} showLabel={isExpanded} />
              ))}
            </div>
          </div>
        )}

        {secondaryItems.length > 0 && (
          <div>
            {isExpanded && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-1">Management</p>
            )}
            <div className="space-y-1">
              {secondaryItems.map(item => (
                <NavItem key={item.href} item={item} showLabel={isExpanded} />
              ))}
            </div>
          </div>
        )}

        {tertiaryItems.length > 0 && (
          <div>
            {isExpanded && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-1">Tools</p>
            )}
            <div className="space-y-1">
              {tertiaryItems.map(item => (
                <NavItem key={item.href} item={item} showLabel={isExpanded} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pin indicator when collapsed and pinned */}
      {!isExpanded && pinned && (
        <div className="px-3 py-2 border-t border-zinc-800 flex justify-center">
          <span className="text-xs text-zinc-600">📌</span>
        </div>
      )}
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </aside>
  );
}