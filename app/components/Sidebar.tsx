"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "../../lib/supabase";

export default function Sidebar() {

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

 return (

  <aside className="w-72 min-h-screen bg-black text-white px-6 py-8">

    <div className="mb-12">

      <h1 className="text-4xl font-black tracking-tight">
        Property OS
      </h1>

      <p className="text-gray-400 mt-2 text-sm">
        Enterprise Operating Platform
      </p>

    </div>

    <div className="bg-gray-900 rounded-2xl p-5 mb-10 border border-gray-800">

      <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">
        Logged In As
      </p>

      <p className="font-bold text-lg">
        {role}
      </p>

    </div>

    <nav className="space-y-3">

      <Link
        href="/leases"
        className="block bg-gray-900 hover:bg-gray-800 transition-all p-4 rounded-xl font-semibold"
      >
        Lease Dashboard
      </Link>

      <Link
        href="/tenants"
        className="block hover:bg-gray-900 transition-all p-4 rounded-xl"
      >
        Tenant CRM
      </Link>

      <Link
        href="/imports"
        className="block hover:bg-gray-900 transition-all p-4 rounded-xl"
      >
        Import Center
      </Link>

      <Link
        href="/executive"
        className="block hover:bg-gray-900 transition-all p-4 rounded-xl"
      >
        Executive Dashboard
      </Link>

      <Link
        href="/calendar"
        className="block hover:bg-gray-900 transition-all p-4 rounded-xl"
      >
        Operational Calendar
      </Link>

      <Link
        href="/financials"
        className="block hover:bg-gray-900 transition-all p-4 rounded-xl"
      >
        Financial Operations
      </Link>

      <Link
        href="/notifications"
        className="block hover:bg-gray-900 transition-all p-4 rounded-xl"
      >
        Notifications Center
      </Link>

      {role === "Admin" && (

        <Link
          href="/admin"
          className="block hover:bg-gray-900 transition-all p-4 rounded-xl"
        >
          Admin Console
        </Link>

      )}

    </nav>

  </aside>
);
}