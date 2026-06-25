"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAccess() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    router.replace("/landing");
    return;
  }

  const { data: access, error } = await supabase
    .from("user_entity_access")
    .select("id")
    .eq("user_id", session.user.id)
    .limit(1);

  if (error) console.error("Access check error:", error);
  console.log("Access check:", access?.length, "hasAccess:", access && access.length > 0);

  if (access && access.length > 0) {
    setHasAccess(true);
  }

  setReady(true);
  setChecking(false);
}
    checkAccess();
  }, []);
console.log("ready:", ready, "hasAccess:", hasAccess);
  if (!ready) return null;

  if (!hasAccess) {
  return (
    <div className="fixed inset-0 z-[200] bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <img src="/logo.png" alt="AssetFlow" className="w-12 h-12 rounded-lg mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Account Pending Approval</h1>
        <p className="text-[var(--text-secondary)] mt-4 leading-relaxed">
          Your account has been created successfully. An administrator must assign you to an entity before you can access portfolio data.
        </p>
        <p className="text-[var(--text-muted)] text-sm mt-3">
          If you believe this is an error, contact your system administrator.
        </p>
        <p className="text-[var(--text-muted)] text-xs mt-8">AssetFlow</p>
      </div>
    </div>
  );
}

  return <>{children}</>;
}
