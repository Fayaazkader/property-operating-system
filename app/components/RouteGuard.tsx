'use client';

import { usePathname } from 'next/navigation';
import AppLayout from './layout/AppLayout';

const MARKETING_PATHS = ['/marketing', '/pricing', '/platform', '/resources', '/company', '/contact', '/about', '/security', '/privacy', '/terms'];

export default function RouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSigningRoute = pathname?.startsWith('/execution/sign/');
  const isPublicRoute = MARKETING_PATHS.some(p => pathname === p || pathname?.startsWith(p + '/'));

  if (isSigningRoute || isPublicRoute) {
    return <div className="min-h-screen bg-black">{children}</div>;
  }

  return <AppLayout>{children}</AppLayout>;
}
