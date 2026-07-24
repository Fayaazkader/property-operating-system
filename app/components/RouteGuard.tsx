'use client';

import { usePathname } from 'next/navigation';
import AppLayout from './layout/AppLayout';
import { ROUTES } from '@/lib/routes';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSigningRoute = pathname?.startsWith('/execution/sign/');
  const isPublicRoute = pathname === '/' || ROUTES.PUBLIC_PREFIXES.some(p => pathname === p || pathname?.startsWith(p + '/'));

  if (isSigningRoute || isPublicRoute) {
    return <div className="min-h-screen bg-black">{children}</div>;
  }

  return <AppLayout>{children}</AppLayout>;
}
