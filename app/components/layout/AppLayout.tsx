'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import { CommandPaletteProvider } from '@/lib/platform/CommandPaletteContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isFullPage = pathname === '/login' || 
                     pathname === '/signup' || 
                     pathname === '/landing';

  if (isFullPage) {
    return <div className="min-h-screen bg-black">{children}</div>;
  }

  return (
    <CommandPaletteProvider>
      <div className="flex h-screen overflow-hidden bg-black">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-zinc-950">
          <div className="p-5 lg:p-6">
            <div className="min-h-full rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
              <Navbar />
              <div className="bg-zinc-950 min-h-[calc(95vh-80px)]">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </CommandPaletteProvider>
  );
}
