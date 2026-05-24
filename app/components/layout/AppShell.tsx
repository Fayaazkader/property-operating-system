"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/app/config/navigation";



type Props = {
  children: ReactNode;
};

export default function AppShell({
  children,
}: Props) {

  const pathname = usePathname();
  const currentRole =
  "executive";

  return (

    <div className="flex min-h-screen bg-zinc-100">

      <aside className="hidden lg:flex w-72 flex-col bg-black text-white p-6">

        <div className="mb-10">

          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">

            Rentora

          </p>

          <h1 className="text-3xl font-black">

            Property OS

          </h1>

        </div>

        <nav className="space-y-2">

         {navigation
  .filter((item) =>
    item.roles.includes(currentRole)
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

      <main className="flex-1 p-6">

        {children}

      </main>

    </div>

  );
}