"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics/tracker";
// In app/layout.tsx, near the top with other imports
import "@/lib/events";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
  let mounted = true;

  async function checkAccess() {
    try {
      console.log("[ProtectedLayout] Checking session...");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      console.log("[ProtectedLayout] Session:", !!session);
      console.log("[ProtectedLayout] Session error:", sessionError);

      if (!mounted) return;

      if (sessionError || !session) {
        console.log("[ProtectedLayout] No session — redirecting to /landing");

        setReady(true);
        router.replace("/landing");
        return;
      }

      console.log("[ProtectedLayout] Checking entity access...");

      const { data: access, error } = await supabase
        .from("user_entity_access")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1);

      if (!mounted) return;

      console.log("[ProtectedLayout] Access:", access);
      console.log("[ProtectedLayout] Access error:", error);

      if (error) {
        console.error(
          "[ProtectedLayout] Access check error:",
          error.message,
          error.code
        );

        // Keep the existing fallback behaviour.
        setHasAccess(true);
      } else if (access && access.length > 0) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }

      setReady(true);

      console.log("[ProtectedLayout] READY");
    } catch (error) {
      console.error("[ProtectedLayout] Initialization failed:", error);

      if (!mounted) return;

      // Do not leave the application permanently blank.
      setHasAccess(true);
      setReady(true);
    }
  }

  checkAccess();

  return () => {
    mounted = false;
  };
}, [router]);
  useEffect(() => {
  if (ready && hasAccess) {
    trackEvent(AnalyticsEvents.PAGE_VIEW, undefined, { path: pathname });
  }
}, [pathname, ready, hasAccess]);

  if (!ready) {
  return (
    <div className="fixed inset-0 z-[200] bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="text-sm text-[var(--text-muted)]">
        Loading AssetFlow...
      </div>
    </div>
  );
}

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
