import { supabase } from "./supabase";

export async function getExecutiveMetrics() {

  const [
    propertiesResult,
    unitsResult,
    leasesResult,
    tenantsResult,
    invoicesResult,
    recoveriesResult,
    tasksResult,
  ] = await Promise.all([

    supabase
      .from("properties")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("units")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("leases")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("lease_status", "active"),

    supabase
      .from("tenants")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("invoices")
      .select("outstanding_amount"),

    supabase
      .from("recoveries")
      .select("under_recovery_amount"),

    supabase
      .from("tasks")
      .select("*", {
        count: "exact",
        head: true,
      })
      .gte("escalation_level", 2),

  ]);

  const totalArrearsExposure =
    invoicesResult.data?.reduce(
      (sum, invoice) =>
        sum +
        Number(
          invoice.outstanding_amount || 0
        ),
      0
    ) || 0;

  const totalUnderRecoveryExposure =
    recoveriesResult.data?.reduce(
      (sum, recovery) =>
        sum +
        Number(
          recovery.under_recovery_amount || 0
        ),
      0
    ) || 0;

  return {

    totalProperties:
      propertiesResult.count || 0,

    totalUnits:
      unitsResult.count || 0,

    activeLeases:
      leasesResult.count || 0,

    totalTenants:
      tenantsResult.count || 0,

    criticalOperationalTasks:
      tasksResult.count || 0,

    totalArrearsExposure,

    totalUnderRecoveryExposure,

  };
}