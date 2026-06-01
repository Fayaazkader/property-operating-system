"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import { usePathname } from "next/navigation";

import { supabase } from "../../lib/supabase";
import {
  getNavigationForRole,
} from "@/lib/rbac/navigation";

import { usePlatform } from "../context/PlatformContext";
import { roles } from "@/app/config/roles";

export default function Sidebar() {

  const pathname = usePathname();
  const {
  activeRole,
  setActiveRole,
} = usePlatform();
const [
  collapsed,
  setCollapsed,
] = useState(false);


  return (

    <aside
  className={`
    ${
      collapsed
        ? "w-20"
        : "w-64"
    }
min-h-screen
bg-black
text-white
flex
flex-col
relative
z-50
border-r
border-zinc-800
group
relative
transition-all
duration-300
  `}
> 
<div className="flex justify-end p-3">

  <button
    onClick={() =>
      setCollapsed(
        !collapsed
      )
    }
    className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white"
  >

    {collapsed
      ? "→"
      : "←"}

  </button>

</div>

      <div className="px-6 pt-8 pb-6 border-b border-zinc-800">

      

  <h1
  className={`
    text-4xl
    font-black
    tracking-tight
    transition-all
    duration-300
    ${
      collapsed
  ? "opacity-0 translate-x-2"
  : "opacity-100 translate-x-0"
    }
  `}
>

    Property OS

  </h1>


        {!collapsed && (

  <p className="text-zinc-500 mt-2 text-sm">

    Enterprise Operating Platform

  </p>
  

)}
{!collapsed && pathname.startsWith("/operations") && (

  <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">

    <p className="text-xs uppercase tracking-[0.25em] text-blue-300 mb-1">

      Active Workspace

    </p>

    <p className="text-sm font-semibold text-white">

      Operations Governance

    </p>

  </div>

)}

      </div>

    
      <div className="px-4 flex-1 overflow-y-auto">

        {!collapsed && (

  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 px-3 mb-4">

    Workspace

  </p>

)}

        <nav className="space-y-2">

        {getNavigationForRole(
  activeRole.id as any
).map((item) => {

            const isActive =
              pathname === item.href;

            return (

              <Link
                key={item.href}
                href={item.href}
                className={`
  flex
  items-center
  h-14
  ${
    collapsed
      ? "justify-center"
      : ""
  }
  rounded-3xl
  ${
  collapsed
    ? "px-0"
    : "px-4"
}
  py-4
  text-sm
  font-medium
  transition-all
  duration-200

  ${
    isActive
  ? "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.15)] border border-white/20"
  : "text-zinc-400 hover:bg-zinc-900 hover:text-white border border-transparent"
  }
`}
              >
{collapsed
  ? (
      item.label === "Executive"
        ? "◧"
        : item.label === "Properties"
        ? "⌂"
        : item.label === "Leases"
        ? "◫"
        : item.label === "Tasks"
        ? "⚙"
        : item.label === "Documents"
        ? "▣"
        : item.label === "Reports"
        ? "◩"
        : item.label === "Operations"
        ? "◎"
        : "•"
    )
  : item.label}
  {collapsed && (

  <div className="pointer-events-none absolute left-16 z-50 whitespace-nowrap rounded-xl border border-zinc-800 bg-black px-3 py-2 text-xs font-medium text-white opacity-0 shadow-2xl transition-all duration-200 group-hover:opacity-100">

    {item.label}

  </div>

)}
              </Link>

            );
          })}

         

        </nav>
        

      </div>
    

      {!collapsed && (
        

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
      )}

    </aside>
  );
}