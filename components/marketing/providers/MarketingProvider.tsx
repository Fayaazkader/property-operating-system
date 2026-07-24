'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface MarketingContextType {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const MarketingContext = createContext<MarketingContextType>({
  mobileMenuOpen: false,
  setMobileMenuOpen: () => {},
});

export function useMarketing() {
  return useContext(MarketingContext);
}

interface MarketingProviderProps {
  children: ReactNode;
}

export function MarketingProvider({ children }: MarketingProviderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <MarketingContext.Provider value={{ mobileMenuOpen, setMobileMenuOpen }}>
      {children}
    </MarketingContext.Provider>
  );
}
