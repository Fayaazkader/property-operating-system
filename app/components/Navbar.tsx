"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { CommandPalette } from "./layout/CommandPalette";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  if (pathname === '/login' || pathname === '/signup') {
    return null;
  }

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
      }
    }
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
      } else {
        setEmail("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmail("");
    setShowDropdown(false);
    router.push('/login');
  };

  return (
    <div className="bg-black border-b border-[var(--border-default)] px-6 py-3 flex items-center justify-between relative z-50">
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">AssetFlow</h1>
      </div>

      <div className="flex-1 max-w-xl mx-6">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-muted)] text-left hover:border-[var(--border-hover)] transition-colors flex items-center gap-3"
        >
          <span>⌘K</span>
          <span className="flex-1">Ask AssetFlow anything...</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button className="w-9 h-9 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] flex items-center justify-center text-sm text-[var(--text-muted)] hover:border-[var(--border-hover)] transition-colors">
          🔔
        </button>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-xs font-bold text-black">
              {email ? email.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="hidden md:block">
              <p className="text-xs text-[var(--text-muted)]">{email || "Not signed in"}</p>
            </div>
            <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg py-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-default)]">
                <p className="text-sm font-medium text-[var(--text-primary)]">{email || "Not signed in"}</p>
                <p className="text-xs text-[var(--text-muted)]">Signed in</p>
              </div>
              <button
                onClick={() => router.push('/settings')}
                className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Settings
              </button>
              <button
                onClick={() => router.push('/settings/import')}
                className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Import Data
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/5 transition-colors border-t border-[var(--border-default)]"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}
