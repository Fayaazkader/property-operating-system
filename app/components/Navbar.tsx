"use client";

import { useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";

export default function Navbar() {

  const [email, setEmail] =
    useState("");

  useEffect(() => {

    async function getUser() {

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {

        setEmail(user.email);
      }
    }

    getUser();

  }, []);

  return (

    <div className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center rounded-t-2xl">

      <div>

        <h1 className="text-2xl font-black text-black">
          Property OS
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          Enterprise Property Operating Platform
        </p>

      </div>

      <div className="flex items-center gap-6">

        <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-xs uppercase tracking-widest font-bold">
          Live Environment
        </div>

        <div className="text-right">

          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
            Logged In User
          </p>

          <p className="font-bold text-gray-900">
            {email}
          </p>

        </div>

      </div>

    </div>
  );
}