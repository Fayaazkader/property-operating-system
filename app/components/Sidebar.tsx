"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import { usePathname } from "next/navigation";

import { supabase } from "../../lib/supabase";

export default function Sidebar() {

  const pathname = usePathname();

  const [role, setRole] =
    useState("Asset Manager");

  useEffect(() => {

    async function fetchRole() {

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email)
        return;

      const { data } =
        await supabase
          .from("user_roles")
          .select("*")
          .eq(
            "user_email",
            user.email
          )
          .single();

      if (data?.role) {

        setRole(data.role);
      }
    }

    fetchRole();

  }, []);

  const navigation = [
    {
      label: "Lease Dashboard",
      href: "/leases",
    },
    {
      label: "Tenant CRM",
      href: "/tenants",
    },
    {
      label: "Import Center",
      href: "/imports",
    },
    {
      label: "Executive Dashboard",
      href: "/executive",
    },
    {
      label: "Operational Calendar",
      href: "/calendar",
    },
    {
      label: "Financial Operations",
      href: "/financials",
    },
    {
      label: "Notifications Center",
      href: "/notifications",
    },
  ];

  return (

    <aside className="w-72 min-h-screen bg-black text-white flex flex-col border-r border-zinc-800">

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
            {role}
          </p>

        </div>

      </div>

      <div className="px-4 flex-1 overflow-y-auto">

        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 px-3 mb-4">
          Workspace
        </p>

        <nav className="space-y-2">

          {navigation.map((item) => {

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

          {role === "Admin" && (

            <Link
              href="/admin"
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
                  pathname === "/admin"
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }
              `}
            >
              Admin Console
            </Link>

          )}

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