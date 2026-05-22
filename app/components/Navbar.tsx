"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Navbar() {

  const router = useRouter();

  async function handleLogout() {

    await supabase.auth.signOut();

    router.push("/login");
  }

  return (

    <div className="bg-black text-white px-8 py-4 flex justify-between items-center">

      <h1 className="text-2xl font-bold">
        Property OS
      </h1>

      <button
        onClick={handleLogout}
        className="border border-white px-4 py-2 rounded-lg"
      >
        Logout
      </button>

    </div>

  );
}