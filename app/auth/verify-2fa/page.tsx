"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Verify2FAPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify() {
  setLoading(true);
  setError("");

  const { data: { session } } = await supabase.auth.getSession();
  const factors = session?.user?.factors || [];
  const totpFactor = factors.find((f: any) => f.type === "totp");

  if (!totpFactor) {
    setError("No 2FA configured. Contact your administrator.");
    setLoading(false);
    return;
  }

  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
    factorId: totpFactor.id,
    code,
  });

  if (verifyError) {
    setError(verifyError.message);
    setLoading(false);
  } else {
    router.push("/");
  }
}

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B]">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Verify Your Identity</h1>
          <p className="text-[var(--text-secondary)] mt-2">Enter the code from your authenticator app</p>
        </div>

        {error && <p className="text-sm text-red-400 mb-4 text-center">{error}</p>}

        <div className="space-y-4">
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="000000" maxLength={6}
            className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] text-center text-2xl tracking-widest" />
          <button onClick={handleVerify} disabled={loading || code.length !== 6}
            className="w-full rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
            {loading ? "Verifying..." : "Verify"}
          </button>
        </div>
      </div>
    </div>
  );
}