"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/app/config/navigation";
import { companies } from "@/app/config/companies";
import { usePlatform } from "../../context/PlatformContext";



type Props = {
  children: ReactNode;
};

export default function AppShell({
  children,
}: Props) {

  const pathname = usePathname();
  const {
  activeCompany,
  setActiveCompany,
  activeRole,
  setActiveRole,
} = usePlatform();
  
  

  return (

    <div className="flex h-screen overflow-hidden bg-zinc-100">

      <aside className="hidden lg:flex w-72 flex-col bg-black text-white p-6 overflow-y-auto">

        <div className="mb-10">

          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">

            Rentora

          </p>

          <h1 className="text-3xl font-black">

            Property OS

          </h1>
          <p className="mt-3 text-sm text-zinc-500">

  {activeCompany.name}

</p>
<div className="mt-6 space-y-2">

  {companies.map((company) => (

    <button
  key={company.id}
  onClick={() =>
    setActiveCompany(company)
  }
      className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition
      ${
        company.id === activeCompany.id
          ? "border-white bg-white text-black"
          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
      }`}
    >

      {company.name}

    </button>

  ))}

</div>

        </div>

        <nav className="space-y-2">

         {navigation
  .filter((item) =>
    item.roles.includes(activeRole.id)
  )
  .map((item) => {

            const active =
              pathname === item.href;

            return (

              <Link
                key={item.label}
                href={item.href}
                className={`block rounded-2xl px-5 py-4 text-sm font-semibold transition
                ${
                  active
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >

                {item.label}

              </Link>

            );

          })}

        </nav>

        <div className="mt-auto rounded-2xl bg-zinc-900 p-5">

          <p className="text-sm text-zinc-400 mb-2">

            Platform Status

          </p>

          <p className="font-bold text-green-400">

            Systems Operational

          </p>

        </div>

      </aside>

      <main className="flex-1 overflow-y-auto p-6">

        {children}

      </main>

    </div>

  );
}