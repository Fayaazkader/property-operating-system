"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

import { companies } from "@/app/config/companies";
import { roles } from "@/app/config/roles";

type PlatformContextType = {
  activeCompany: typeof companies[0];
  setActiveCompany: (
    company: typeof companies[0]
  ) => void;
  activeRole: typeof roles[0];

setActiveRole: (
  role: typeof roles[0]
) => void;
  
};

const PlatformContext =
  createContext<PlatformContextType | null>(
    null
  );

type Props = {
  children: ReactNode;
};

export function PlatformProvider({
  children,
}: Props) {

  const [
    activeCompany,
    setActiveCompany,
  ] = useState(companies[0]);
  const [
  activeRole,
  setActiveRole,
] = useState(roles[0]);

  return (

    <PlatformContext.Provider
      value={{
        activeCompany,
        setActiveCompany,
        activeRole,
setActiveRole,
      }}
    >

      {children}

    </PlatformContext.Provider>

  );
}

export function usePlatform() {

  const context =
    useContext(PlatformContext);

  if (!context) {

    throw new Error(
      "usePlatform must be used inside PlatformProvider"
    );
  }

  return context;
}