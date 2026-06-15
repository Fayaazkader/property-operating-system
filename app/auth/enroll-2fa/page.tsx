"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Enroll2FAPage() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"qr" | "verify">("qr");

  useEffect(() => {
    async function startEnroll() {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) {
        setError(error.message);
        return;
      }
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }
    startEnroll();
  }, []);

async function handleVerify() {
  setLoading(true);
  setError("");

  const { data: { session } } = await supabase.auth.getSession();
  const factors = session?.user?.factors || [];
  const totpFactor = factors.find((f: any) => f.type === "totp");

  if (!totpFactor) {
    setError("No TOTP factor found. Please scan the QR code first.");
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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Two-Factor Authentication</h1>
          <p className="text-[var(--text-secondary)] mt-2">
            {step === "qr" ? "Scan this QR code with your authenticator app" : "Enter the verification code"}
          </p>
        </div>

        {error && <p className="text-sm text-red-400 mb-4 text-center">{error}</p>}

        {step === "qr" && qrCode && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <img src={qrCode} alt="QR Code" className="rounded-2xl" />
            </div>
            <p className="text-xs text-[var(--text-muted)] text-center">
              Or enter this code manually: <span className="font-mono text-[var(--text-primary)]">{secret}</span>
            </p>
            <button onClick={() => setStep("verify")}
              className="w-full rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-3 text-sm font-semibold hover:opacity-90">
              I've Scanned It
            </button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4">
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code" maxLength={6}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] text-center text-2xl tracking-widest" />
            <button onClick={handleVerify} disabled={loading || code.length !== 6}
              className="w-full rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
              {loading ? "Verifying..." : "Verify & Enable 2FA"}
            </button>
            <button onClick={() => setStep("qr")}
              className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              ← Back to QR code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}