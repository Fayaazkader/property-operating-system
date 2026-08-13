'use client';

import { usePathname } from 'next/navigation';
import AppLayout from './layout/AppLayout';
import { EntityProvider } from '@/app/context/EntityContext';

export default function RouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSigningRoute = pathname?.startsWith('/execution/sign/');

  if (isSigningRoute) {
    return <div className="min-h-screen bg-[var(--bg-primary)]">{children}</div>;
  }

  return (
    <EntityProvider>
      <AppLayout>{children}</AppLayout>
    </EntityProvider>
  );
}
