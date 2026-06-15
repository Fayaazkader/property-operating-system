"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CommandPalette } from "./layout/CommandPalette";

export default function Navbar() {
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
        setUserName(user.email.split("@")[0]);
      }
    }
    getUser();
  }, []);

  return (
    <div className="bg-black border-b border-[var(--border-default)] px-6 py-3 flex items-center justify-between">
      {/* Left: Brand */}
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">AssetFlow</h1>
      </div>

      {/* Center: Global Search */}
      <div className="flex-1 max-w-xl mx-6">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-muted)] text-left hover:border-[var(--border-hover)] transition-colors flex items-center gap-3"
        >
          <span>🔍</span>
          <span className="flex-1">Ask AssetFlow anything...</span>
          <span className="text-xs text-[var(--text-muted)]">⌘K</span>
        </button>
      </div>

      {/* Right: User */}
      <div className="flex items-center gap-4">
        <button className="w-9 h-9 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] flex items-center justify-center text-sm text-[var(--text-muted)] hover:border-[var(--border-hover)] transition-colors">
          🔔
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-xs font-bold text-black">
            {email ? email.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="hidden md:block">
            <p className="text-xs text-[var(--text-muted)]">{email || "Signed in"}</p>
          </div>
        </div>
      </div>

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}