"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import { usePathname } from "next/navigation";

import { supabase } from "../../lib/supabase";
import { navigation } from "@/app/config/navigation";

import { usePlatform } from "../context/PlatformContext";
import { roles } from "@/app/config/roles";

export default function Sidebar() {

  const pathname = usePathname();
  const {
  activeRole,
  setActiveRole,
} = usePlatform();


  return (

    <aside className="w-64 min-h-screen bg-black text-white flex flex-col border-r border-zinc-800">

      <div className="px-6 pt-8 pb-6 border-b border-zinc-800">

        <h1 className="text-4xl font-black tracking-tight">
          Property OS
        </h1>

        <p className="text-zinc-500 mt-2 text-sm">
          Enterprise Operating Platform
        </p>

      </div>

      <div className="px-6 py-6">

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">

          <p className="text-zinc-500 text-xs uppercase tracking-[0.2em] mb-2">
            Logged In As
          </p>

        <p className="font-semibold text-lg text-white">

  {activeRole.label}

</p>

<div className="mt-5 space-y-2">

  {roles.map((role) => (

    <button
      key={role.id}
      onClick={() =>
        setActiveRole(role)
      }
      className={`
        w-full
        rounded-xl
        border
        px-3
        py-2
        text-left
        text-sm
        transition

        ${
          activeRole.id === role.id
            ? "border-white bg-white text-black"
            : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700 hover:text-white"
        }
      `}
    >

      {role.label}

    </button>

  ))}

</div>

        </div>

      </div>

      <div className="px-4 flex-1 overflow-y-auto">

        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 px-3 mb-4">
          Workspace
        </p>

        <nav className="space-y-2">

        {navigation
  .filter((item) =>
    item.roles.includes(activeRole.id)
  )
  .map((item) => {

            const isActive =
              pathname === item.href;

            return (

              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex
                  items-center
                  rounded-2xl
                  px-4
                  py-4
                  text-sm
                  font-medium
                  transition-all
                  duration-200

                  ${
                    isActive
                      ? "bg-white text-black shadow-sm"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  }
                `}
              >
                {item.label}
              </Link>

            );
          })}

         

        </nav>

      </div>

      <div className="p-6 border-t border-zinc-800">

        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">

          <p className="text-sm font-semibold mb-1">
            Rentora Enterprise
          </p>

          <p className="text-xs text-zinc-500">
            Commercial property operating intelligence platform.
          </p>

        </div>

      </div>

    </aside>
  );
}