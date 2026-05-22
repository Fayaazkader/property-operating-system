"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignup() {

    const result = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    console.log(result);

    if (result.error) {

      alert(result.error.message);

    } else {

      alert("Account created successfully");
    }
  }

  async function handleLogin() {

    const result =
      await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

    console.log(result);

    if (result.error) {

      alert(result.error.message);

    } else {

      alert("Login successful");

      router.push("/leases");
    }
  }

  return (

    <main className="min-h-screen flex items-center justify-center bg-gray-100 text-black">

      <div className="bg-white p-10 rounded-xl shadow w-full max-w-md">

        <h1 className="text-3xl font-bold mb-8 text-center">
          Platform Login
        </h1>

        <div className="space-y-6">

          <div>

            <label className="block mb-2 font-semibold">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg p-3"
            />

          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-black text-white py-3 rounded-lg"
          >
            Login
          </button>

          <button
            onClick={handleSignup}
            className="w-full border border-black py-3 rounded-lg"
          >
            Create Account
          </button>

        </div>

      </div>

    </main>
  );
}