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
  export async function getCriticalLeaseExposure() {

  const { data, error } =
    await supabase

      .from("leases")

      .select(`
        lease_id,
        tenant_name,
        property_name,
        expiry_date,
        monthly_rental,
        gla_sqm
      `)

      .lte(
        "expiry_date",
        new Date(
          Date.now() +
          1000 * 60 * 60 * 24 * 90
        ).toISOString()
      )

      .eq("lease_status", "active")

      .order("expiry_date", {
        ascending: true,
      })

      .limit(5);

  if (error) {

    console.error(error);

    return [];

  }

  return data || [];
}
export async function getCriticalOperationalTasks() {

  const { data, error } =
    await supabase

      .from("tasks")

      .select(`
        task_id,
        task_type,
        property_name,
        tenant_name,
        priority,
        escalation_level,
        due_date,
        task_status
      `)

      .gte("escalation_level", 2)

      .order("escalation_level", {
        ascending: false,
      })

      .limit(5);

  if (error) {

    console.error(error);

    return [];

  }

  return data || [];
}
export async function getArrearsExposure() {

  const { data, error } =
    await supabase

      .from("invoices")

      .select(`
        invoice_number,
        outstanding_amount,
        due_date,
        payment_status,
        tenant_id,
        property_id
      `)

      .gt("outstanding_amount", 0)

      .order("outstanding_amount", {
        ascending: false,
      })

      .limit(5);

  if (error) {

    console.error(error);

    return [];

  }

  return data || [];
}
export async function getOccupancyOverview() {

  const { data, error } =
    await supabase

      .from("properties")

      .select(`
        property_name,
        rentable_area_sqm,
        occupied_area_sqm,
        vacancy_area_sqm
      `)

      .limit(5);

  if (error) {

    console.error(error);

    return [];

  }

  return (data || []).map((property) => {

    const rentable =
      Number(property.rentable_area_sqm || 0);

    const occupied =
      Number(property.occupied_area_sqm || 0);

    const occupancyPercentage =
      rentable > 0
        ? ((occupied / rentable) * 100).toFixed(1)
        : "0";

    return {

      ...property,

      occupancyPercentage,

    };

  });
}
export async function getExecutiveActionItems() {

  const { data, error } =
    await supabase

      .from("tasks")

      .select(`
        task_id,
        task_type,
        property_name,
        tenant_name,
        priority,
        escalation_level,
        due_date,
        task_status
      `)

      .neq("task_status", "Completed")

      .order("escalation_level", {
        ascending: false,
      })

      .order("due_date", {
        ascending: true,
      })

      .limit(6);

  if (error) {

    console.error(error);

    return [];

  }

  return data || [];
}