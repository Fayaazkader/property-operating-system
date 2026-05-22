import { supabase } from "../../lib/supabase";
import PageShell from "../components/layout/PageShell";
import PageHeader from "../components/layout/PageHeader";
import Toolbar from "../components/layout/Toolbar";
import SearchInput from "../components/layout/SearchInput";
import ToolbarButton from "../components/layout/ToolbarButton";
import KpiCard from "../components/dashboard/KpiCard";

export default async function ExecutivePage() {

  const { data: leases } =
    await supabase
      .from("leases")
      .select("*");

  const { data: tasks } =
    await supabase
      .from("tasks")
      .select("*");

  const totalRental =
    leases?.reduce(
      (sum, lease) =>
        sum +
        (lease.monthly_rental || 0),
      0
    ) || 0;

  const criticalLeases =
    leases?.filter((lease) => {

      if (!lease.expiry_date)
        return false;

      const expiry =
        new Date(
          lease.expiry_date
        );

      const today =
        new Date();

      const diffDays =
        Math.ceil(
          (expiry.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
        );

      return diffDays <= 30;

    }).length || 0;

  const openTasks =
    tasks?.filter(
      (task) =>
        task.status !== "Completed"
    ).length || 0;

  const completedTasks =
    tasks?.filter(
      (task) =>
        task.status === "Completed"
    ).length || 0;

  return (

    <PageShell>

      <PageHeader
        title="Executive Dashboard"
        subtitle="Strategic portfolio and operational intelligence."
      />

      <Toolbar>

        <SearchInput />

        <div className="flex flex-wrap items-center gap-3">

          <ToolbarButton label="Export Report" />

          <ToolbarButton label="Filter Assets" />

          <ToolbarButton label="Generate Insights" />

        </div>

      </Toolbar>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        <KpiCard
          title="Portfolio Revenue"
          value={`R ${totalRental.toLocaleString()}`}
          trend="Monthly recurring portfolio income"
        />

        <KpiCard
          title="Critical Lease Risk"
          value={criticalLeases}
          status="Urgent"
          valueColor="text-red-600"
          trend="Expiring within 30 days"
        />

        <KpiCard
          title="Open Operational Tasks"
          value={openTasks}
          status="Active"
          valueColor="text-orange-500"
          trend="Pending operational actions"
        />

        <KpiCard
          title="Completed Tasks"
          value={completedTasks}
          status="Healthy"
          valueColor="text-green-600"
          trend="Operational workflow completion"
        />

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">

          <div className="flex items-center justify-between mb-8">

            <h2 className="text-2xl font-bold text-black">
              Portfolio Health
            </h2>

            <span className="text-sm font-medium text-green-600">
              Stable
            </span>

          </div>

          <div className="space-y-5">

            <div className="flex items-center justify-between border-b pb-4">

              <span className="text-zinc-600">
                Stable Assets
              </span>

              <span className="font-semibold text-green-600">
                Good
              </span>

            </div>

            <div className="flex items-center justify-between border-b pb-4">

              <span className="text-zinc-600">
                Renewal Exposure
              </span>

              <span className="font-semibold text-orange-500">
                Moderate
              </span>

            </div>

            <div className="flex items-center justify-between">

              <span className="text-zinc-600">
                Vacancy Threat
              </span>

              <span className="font-semibold text-red-600">
                Monitored
              </span>

            </div>

          </div>

        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">

          <div className="flex items-center justify-between mb-8">

            <h2 className="text-2xl font-bold text-black">
              Operational Focus
            </h2>

            <span className="text-sm font-medium text-zinc-500">
              Active
            </span>

          </div>

          <div className="space-y-4">

            <div className="rounded-xl border border-zinc-200 p-5 hover:bg-zinc-50 transition">

              <p className="font-semibold text-black">
                Renewal negotiations due
              </p>

              <p className="text-sm text-zinc-500 mt-1">
                Priority tenant engagements approaching expiry cycle.
              </p>

            </div>

            <div className="rounded-xl border border-zinc-200 p-5 hover:bg-zinc-50 transition">

              <p className="font-semibold text-black">
                High-risk vacancy monitoring
              </p>

              <p className="text-sm text-zinc-500 mt-1">
                Monitor assets with declining occupancy performance.
              </p>

            </div>

            <div className="rounded-xl border border-zinc-200 p-5 hover:bg-zinc-50 transition">

              <p className="font-semibold text-black">
                Tenant engagement required
              </p>

              <p className="text-sm text-zinc-500 mt-1">
                Proactive retention discussions recommended.
              </p>

            </div>

          </div>

        </div>

      </div>

    </PageShell>
  );
}