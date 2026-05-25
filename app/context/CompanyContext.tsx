"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

import { companies } from "@/app/config/companies";

type CompanyContextType = {
  activeCompany: typeof companies[0];
  setActiveCompany: (
    company: typeof companies[0]
  ) => void;
};

const CompanyContext =
  createContext<
    CompanyContextType | undefined
  >(undefined);

export function CompanyProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [
    activeCompany,
    setActiveCompany,
  ] = useState(companies[0]);

  return (

    <CompanyContext.Provider
      value={{
        activeCompany,
        setActiveCompany,
      }}
    >

      {children}

    </CompanyContext.Provider>

  );
}

export function useCompany() {

  const context =
    useContext(CompanyContext);

  if (!context) {

    throw new Error(
      "useCompany must be used within CompanyProvider"
    );
  }

  return context;
}