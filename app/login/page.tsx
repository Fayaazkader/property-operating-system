
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    console.log('Attempting login with:', email);

    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password 
    });

    console.log('Login response:', { data, error });

    if (error) {
      console.error('Login error:', error.message);
      setError(error.message);
      setLoading(false);
    } else {
      console.log('Login successful, redirecting...');
      router.push("/");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B]">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">AssetFlow</h1>
          <p className="text-[var(--text-secondary)] mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" 
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" 
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
