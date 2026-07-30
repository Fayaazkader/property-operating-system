'use client';

import Link from 'next/link';
import { marketing } from '@/lib/marketing.config';
import { marketingAssets } from '@/lib/marketingAssets';
import { Container } from '../layout/Container';

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-black/60 backdrop-blur-xl">
      <Container>
        <nav className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium tracking-tight text-white">
            <img src="/og-image.png" alt="AssetFlow" className="h-8 w-auto" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {marketing.navigation.main.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={marketing.navigation.login.href}
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              {marketing.navigation.login.label}
            </Link>
            <Link
              href={marketing.navigation.cta.href}
              className="rounded-full border border-amber-500/50 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 hover:text-black transition-all duration-300"
            >
              {marketing.navigation.cta.label}
            </Link>
          </div>
        </nav>
      </Container>
    </header>
  );
}
