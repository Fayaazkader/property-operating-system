import type { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  id: string;
  className?: string;
}

export function Section({ children, id, className = '' }: SectionProps) {
  return (
    <section id={id} className={`py-20 md:py-28 ${className}`}>
      {children}
    </section>
  );
}
