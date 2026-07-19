'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Favorite {
  id: string;
  label: string;
  href: string;
  icon: string;
}

const iconMap: Record<string, string> = {
  'cash-book': '🏦', 'suppliers': '🏢', 'invoices': '📄', 'revenue': '💰',
  'trial-balance': '📊', 'settings': '⚙', 'imports': '📥', 'leasing': '📝',
  'tenants': '👥', 'properties': '🏗️', 'reports': '📈',
};

export default function Favorites() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const { data } = await supabase.from('user_preferences').select('favorites').eq('user_id', session.user.id).single();
      if (data?.favorites) setFavorites(data.favorites);
    }
    load();
  }, []);

  async function saveFavorites(favs: Favorite[]) {
    setFavorites(favs);
    if (userId) {
      await supabase.from('user_preferences').upsert({ user_id: userId, favorites: favs }, { onConflict: 'user_id' });
    }
  }

  function addFavorite(href: string, label: string) {
    if (favorites.length >= 20) return;
    const icon = iconMap[href.split('/').pop() || ''] || '📌';
    saveFavorites([...favorites, { id: Date.now().toString(), label, href, icon }]);
    setSearch('');
  }

  function removeFavorite(id: string) {
    saveFavorites(favorites.filter(f => f.id !== id));
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 transition-all text-lg"
        title="Favorites"
      >
        ⭐
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed bottom-20 right-6 z-50 bg-zinc-900 border border-white/[0.08] rounded-2xl shadow-2xl w-80 max-h-[500px] overflow-y-auto">
            <div className="p-4 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-white">Favorites</p>
                <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search to add..."
                className="w-full rounded-lg border border-white/[0.08] bg-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-white/20"
              />
              {search && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {['/financials/cash-book', '/suppliers/suppliers', '/financials/revenue', '/financials/imports', '/financials', '/settings', '/leasing', '/tenants', '/properties', '/reports']
                    .filter(h => h.includes(search.toLowerCase()) || routeLabels[h])
                    .map(h => {
                      const label = routeLabels[h] || h.split('/').pop()?.replace(/-/g, ' ') || h;
                      return (
                        <button key={h} onClick={() => addFavorite(h, label)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-white rounded">
                          + {label}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
            <div className="p-4 grid grid-cols-4 gap-3">
              {favorites.map(f => (
                <div key={f.id} className="relative group">
                  <button
                    onClick={() => { router.push(f.href); setOpen(false); }}
                    className="w-full aspect-square rounded-xl border border-white/[0.06] bg-white/[0.01] flex flex-col items-center justify-center gap-1 hover:bg-white/[0.03] transition-all"
                    title={f.label}
                  >
                    <span className="text-lg">{f.icon}</span>
                    <span className="text-[8px] text-zinc-400 text-center leading-tight truncate w-full px-1">{f.label.length > 10 ? f.label.slice(0, 10) : f.label}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFavorite(f.id); }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
              {favorites.length === 0 && <p className="col-span-4 text-xs text-zinc-600 text-center py-4">No favorites yet. Search above to add.</p>}
            </div>
          </div>
        </>
      )}
    </>
  );
}

const routeLabels: Record<string, string> = {
  '/financials/cash-book': 'Cash Book', '/suppliers/suppliers': 'Suppliers', '/financials/revenue': 'Revenue Ops',
  '/financials/imports': 'Imports', '/financials': 'Financials', '/settings': 'Settings',
  '/leasing': 'Leasing', '/tenants': 'Tenants', '/properties': 'Properties', '/reports': 'Reports',
};
