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
      const { data: activities } =
  await supabase
    .from("activities")
    .select("*")
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(8);
    const { data: documents } =
  await supabase
    .from("lease_documents")
    .select("*")
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(6);

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
    const portfolioRiskScore =
  (
    criticalLeases * 15 +
    openTasks * 2
  );

const portfolioRiskLevel =
  portfolioRiskScore >= 60
    ? "Critical"
    : portfolioRiskScore >= 30
    ? "Moderate"
    : "Stable";
   const upcomingRenewals =
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

    return diffDays <= 120;

  }) || [];

const executiveAlerts: string[] = [];

if (criticalLeases > 0) {

  executiveAlerts.push(
    `${criticalLeases} leases require urgent renewal engagement.`
  );
}

if (openTasks > 10) {

  executiveAlerts.push(
    `${openTasks} operational tasks remain unresolved.`
  );
}

if (portfolioRiskLevel === "Critical") {

  executiveAlerts.push(
    "Portfolio risk score has reached critical operational exposure."
  );
}

  return (

    <PageShell>

      <PageHeader
        title="Executive Dashboard"
        subtitle="Strategic portfolio and operational intelligence."
      />
      {executiveAlerts.length > 0 && (

  <div className="mb-6 space-y-4">

    {executiveAlerts.map(
      (alert, index) => (

        <div
          key={index}
          className="rounded-2xl border border-red-200 bg-red-50 p-5"
        >

          <div className="flex items-start gap-4">

            <div className="text-2xl">
              ⚠️
            </div>

            <div>

              <p className="font-bold text-red-700 mb-1">
                Executive Alert
              </p>

              <p className="text-red-600">
                {alert}
              </p>

            </div>

          </div>

        </div>

      )
    )}

  </div>

)}

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
        <KpiCard
  title="Portfolio Risk Score"
  value={portfolioRiskScore}
  status={portfolioRiskLevel}
  valueColor={
    portfolioRiskLevel === "Critical"
      ? "text-red-600"
      : portfolioRiskLevel === "Moderate"
      ? "text-orange-500"
      : "text-green-600"
  }
  trend="Calculated operational exposure"
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
<div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">

  <div className="flex items-center justify-between mb-8">

    <div>

      <h2 className="text-2xl font-bold text-black">
        Recent Operational Activity
      </h2>

      <p className="text-zinc-500 mt-2">
        Portfolio-wide operational actions and activity intelligence.
      </p>

    </div>

    <span className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">

      {activities?.length || 0} Events

    </span>

  </div>

  <div className="space-y-4">

    {activities?.length === 0 && (

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">

        <p className="text-zinc-500">
          No operational activity recorded yet.
        </p>

      </div>

    )}

    {activities?.map((activity) => (

      <div
        key={activity.id}
        className="rounded-2xl border border-zinc-200 p-6 hover:bg-zinc-50 transition"
      >

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">

          <div className="flex items-center gap-3">

            <span className="rounded-full bg-black px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-white">

              {activity.activity_type}

            </span>

            <span className="text-sm text-zinc-500">

              {activity.lease_id}

            </span>

          </div>

          <p className="text-sm text-zinc-500">

            {new Date(
              activity.created_at
            ).toLocaleString()}

          </p>

        </div>

        <p className="text-zinc-700 leading-7">

          {activity.activity_note}

        </p>

        <p className="mt-5 text-sm text-zinc-500">

          By: {activity.created_by}

        </p>

      </div>

    ))}

  </div>

</div>
<div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">

  <div className="flex items-center justify-between mb-8">

    <div>

      <h2 className="text-2xl font-bold text-black">
        Recent Portfolio Documents
      </h2>

      <p className="text-zinc-500 mt-2">
        Latest operational and lease documentation uploaded across the portfolio.
      </p>

    </div>

    <span className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">

      {documents?.length || 0} Documents

    </span>

  </div>

  <div className="space-y-4">

    {documents?.length === 0 && (

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">

        <p className="text-zinc-500">
          No documents uploaded yet.
        </p>

      </div>

    )}

    {documents?.map((document) => (

      <div
        key={document.id}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 rounded-2xl border border-zinc-200 p-6 hover:bg-zinc-50 transition"
      >

        <div>

          <div className="flex items-center gap-3 mb-3">

            <p className="text-lg font-bold text-black">

              {document.document_name}

            </p>

            <span className="rounded-full bg-black px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-white">

              {document.document_type}

            </span>

          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">

            <span>
              Lease: {document.lease_id}
            </span>

            <span>
              •
            </span>

            <span>
              Uploaded by {document.uploaded_by}
            </span>

          </div>

        </div>

        <a
          href={document.document_url}
          target="_blank"
          className="inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
        >
          Open Document
        </a>

      </div>

    ))}

  </div>

</div>
<div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">

  <div className="flex items-center justify-between mb-8">

    <div>

      <h2 className="text-2xl font-bold text-black">
        Renewal Pipeline
      </h2>

      <p className="text-zinc-500 mt-2">
        Upcoming lease renewals requiring operational engagement.
      </p>

    </div>

    <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700">

      {upcomingRenewals.length} Upcoming

    </span>

  </div>

  <div className="space-y-4">

    {upcomingRenewals.length === 0 && (

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">

        <p className="text-zinc-500">
          No upcoming renewals identified.
        </p>

      </div>

    )}

    {upcomingRenewals.map((lease) => {

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

      return (

        <div
          key={lease.lease_id}
          className="rounded-2xl border border-zinc-200 p-6 hover:bg-zinc-50 transition"
        >

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

            <div>

              <div className="flex items-center gap-3 mb-3">

                <p className="text-lg font-bold text-black">

                  {lease.tenant_name}

                </p>

                <span className="rounded-full bg-black px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-white">

                  {lease.lease_id}

                </span>

              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">

                <span>
                  {lease.property_name}
                </span>

                <span>
                  •
                </span>

                <span>
                  Expiry: {lease.expiry_date}
                </span>

              </div>

            </div>

            <div className="text-right">

              <p
                className={`
                  text-2xl
                  font-black

                  ${
                    diffDays <= 30
                      ? "text-red-600"
                      : diffDays <= 90
                      ? "text-orange-500"
                      : "text-green-600"
                  }
                `}
              >

                {diffDays} Days

              </p>

              <p className="text-sm text-zinc-500 mt-1">
                Until expiry
              </p>

            </div>

          </div>

        </div>

      );

    })}

  </div>

</div>
    </PageShell>
  );
}