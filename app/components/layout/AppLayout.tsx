'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import { CommandPaletteProvider } from '@/lib/platform/CommandPaletteContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isPublicPage = pathname === '/login' || 
                       pathname === '/signup' || 
                       pathname === '/landing' ||
                       pathname === '/about' ||
                       pathname === '/security' ||
                       pathname === '/contact' ||
                       pathname === '/privacy' ||
                       pathname === '/terms' ||
                       pathname === '/pricing';

  if (isPublicPage) {
    return <div className="min-h-screen bg-[var(--bg-primary)]">{children}</div>;
  }

  return (
    <CommandPaletteProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-[var(--bg-primary)]">
          {children}
        </main>
      </div>
    </CommandPaletteProvider>
  );
}
