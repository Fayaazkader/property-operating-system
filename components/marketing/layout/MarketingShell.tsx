import type { ReactNode } from 'react';

interface MarketingShellProps {
  children: ReactNode;
}

export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <main className="relative z-10 flex-1">
      {children}
    </main>
  );
}
