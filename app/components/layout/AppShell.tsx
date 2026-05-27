"use client";

import { ReactNode } from "react";
import Sidebar from "@/app/components/Sidebar";

type Props = {
  children: ReactNode;
};

export default function AppShell({
  children,
}: Props) {

  return (

    <div className="flex min-h-screen bg-zinc-100">

      <Sidebar />

      <main className="flex-1 p-6">

        {children}

      </main>

    </div>

  );
}