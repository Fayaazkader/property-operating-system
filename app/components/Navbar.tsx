"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CommandPalette } from "./layout/CommandPalette";

export default function Navbar() {
  const [email, setEmail] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
      }
    }
    getUser();
  }, []);

  return (
    <div className="bg-zinc-900 border-b border-zinc-800 px-8 py-5 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            AssetFlow
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Enterprise Property Operating Platform
          </p>
        </div>

        <div className="hidden xl:flex items-center">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="
              w-[320px]
              rounded-2xl
              border
              border-zinc-700
              bg-zinc-800
              px-5
              py-3
              text-sm
              text-zinc-500
              text-left
              outline-none
              transition
              hover:border-zinc-500
            "
          >
            🔍 Ask AssetFlow anything...
          </button>
        </div>
      </div>

      <div className="flex items-center gap-5">
        

        <div className="flex items-center gap-4 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
            {email ? email.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="hidden lg:block">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-1">
              Logged In User
            </p>
            <p className="text-sm font-semibold text-white">
              {email}
            </p>
          </div>
        </div>
      </div>

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}