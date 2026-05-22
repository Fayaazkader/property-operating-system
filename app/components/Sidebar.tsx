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

    <aside className="w-64 min-h-screen bg-black text-white p-6">

      <h2 className="text-3xl font-bold mb-10">
        Property OS
      </h2>

      <div className="mb-8">

        <p className="text-gray-400 text-sm">
          Logged in as
        </p>

        <p className="font-bold">
          {role}
        </p>

      </div>

      <nav className="space-y-2">

        <Link
          href="/leases"
          className="block hover:bg-gray-800 p-3 rounded-lg"
        >
          Lease Dashboard
        </Link>

        <Link
          href="/tenants"
          className="block hover:bg-gray-800 p-3 rounded-lg"
        >
          Tenant CRM
        </Link>

        <Link
          href="/imports"
          className="block hover:bg-gray-800 p-3 rounded-lg"
        >
          Import Center
        </Link>

        <Link
          href="/executive"
          className="block hover:bg-gray-800 p-3 rounded-lg"
        >
          Executive Dashboard
        </Link>

        <Link
          href="/calendar"
          className="block hover:bg-gray-800 p-3 rounded-lg"
        >
          Operational Calendar
        </Link>

        <Link
          href="/financials"
          className="block hover:bg-gray-800 p-3 rounded-lg"
        >
          Financial Operations
        </Link>
        <Link
  href="/notifications"
  className="block hover:bg-gray-800 p-3 rounded-lg"
>
  Notifications Center
</Link>

        {role === "Admin" && (

          <Link
            href="/admin"
            className="block hover:bg-gray-800 p-3 rounded-lg"
          >
            Admin Console
          </Link>

        )}

      </nav>

    </aside>
  );
}