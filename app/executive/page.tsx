import { supabase } from "../../lib/supabase";
import PageShell from "../components/layout/PageShell";
import PageHeader from "../components/layout/PageHeader";
import Toolbar from "../components/layout/Toolbar";
import SearchInput from "../components/layout/SearchInput";
import ToolbarButton from "../components/layout/ToolbarButton";
import KpiCard from "../components/dashboard/KpiCard";
import ExecutiveCommandBanner from "../components/executive/ExecutiveCommandBanner";
import ExecutiveSummaryBar from "../components/executive/ExecutiveSummaryBar";
import PortfolioNavigation from "../components/executive/PortfolioNavigation";
import ExecutivePriorities from "../components/executive/ExecutivePriorities";
import PerformanceTrendAnalysis from "../components/executive/PerformanceTrendAnalysis";
import RecommendedActions from "../components/executive/RecommendedActions";
import CrossPortfolioRiskMatrix from "../components/executive/CrossPortfolioRiskMatrix";
import ExecutiveInsights from "../components/executive/ExecutiveInsights";
import ExecutiveReportCenter from "../components/executive/ExecutiveReportCenter";
import ExecutiveTimeline from "../components/executive/ExecutiveTimeline";
import PortfolioPerformanceTable from "../components/executive/PortfolioPerformanceTable";
import Breadcrumbs from "../components/navigation/Breadcrumbs";
import {
  getExecutiveMetrics,
  getCriticalLeaseExposure,
  getCriticalOperationalTasks,
  getArrearsExposure,
  getOccupancyOverview,
  getExecutiveActionItems,
} from "@/lib/dashboard";
import Link from "next/link";

export default async function ExecutivePage() {
  const metrics =
  await getExecutiveMetrics();
  const criticalLeaseExposure =
  await getCriticalLeaseExposure();
  const criticalOperationalTasks =
  await getCriticalOperationalTasks();
  const arrearsExposure =
  await getArrearsExposure();
  const occupancyOverview =
  await getOccupancyOverview();
  const executiveActionItems =
  await getExecutiveActionItems();

const leases: any[] = [];

const tasks: any[] = [];

const activities: any[] = [];

const documents: any[] = [];
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
        task.status !== "Resolved"
    ).length || 0;

  const resolvedTasks =
    tasks?.filter(
      (task) =>
        task.status === "Resolved"
    ).length || 0;
    const occupancyRate = 91;
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
const executivePriorities = [

    
  {
    level: "HIGH PRIORITY",
    message:
      `${criticalLeases} leases require immediate renewal engagement.`,
    color:
      "border-orange-200 bg-orange-50 text-orange-700",
  },
  

  {
    level: "CRITICAL",
    message:
      "Office portfolio occupancy remains below operational target.",
    color:
      "border-red-200 bg-red-50 text-red-700",
  },

  {
    level: "ACTION REQUIRED",
    message:
      `${openTasks} operational tasks remain unresolved.`,
    color:
      "border-blue-200 bg-blue-50 text-blue-700",
  },

];<div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">

  {/* LEFT COLUMN */}

  <div className="space-y-8">

    {/* LEASE EXPOSURE */}

    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">

      <div className="mb-6">

        <h2 className="text-2xl font-bold text-white">
          Critical Lease Exposure
        </h2>

        <p className="text-zinc-500 text-sm mt-1">
          Active leases expiring within the next 90 days.
        </p>

      </div>

      <div className="space-y-4">

        {criticalLeaseExposure.map((lease) => (

          <div
            key={lease.lease_id}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4"
          >

            <div>

              <p className="font-semibold text-white">
                {lease.tenant_name}
              </p>

              <p className="text-sm text-zinc-500">
                {lease.property_name}
              </p>

            </div>

            <div className="text-right">

              <p className="text-sm text-zinc-400">
                Expiry Date
              </p>

              <p className="font-semibold text-red-500">
                {lease.expiry_date}
              </p>

            </div>

          </div>

        ))}

      </div>

    </div>

    {/* ARREARS */}

    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">

      <div className="mb-6">

        <h2 className="text-2xl font-bold text-white">
          Arrears Exposure
        </h2>

        <p className="text-zinc-500 text-sm mt-1">
          Outstanding tenant receivables requiring recovery attention.
        </p>

      </div>

      <div className="space-y-4">

        {arrearsExposure.map((invoice) => (

          <div
            key={invoice.invoice_number}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4"
          >

            <div>

              <p className="font-semibold text-white">
                {invoice.invoice_number}
              </p>

              <p className="text-sm text-zinc-500">
                {invoice.payment_status}
              </p>

            </div>

            <div className="text-right">

              <p className="text-sm text-zinc-400">
                Outstanding
              </p>

              <p className="font-semibold text-red-500">
                R {Number(invoice.outstanding_amount).toLocaleString()}
              </p>

            </div>

          </div>

        ))}

      </div>

    </div>

    {/* OCCUPANCY */}

    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">

      <div className="mb-6">

        <h2 className="text-2xl font-bold text-white">
          Occupancy Intelligence
        </h2>

        <p className="text-zinc-500 text-sm mt-1">
          Real-time portfolio occupancy visibility.
        </p>

      </div>

      <div className="space-y-4">

        {occupancyOverview.map((property) => (

          <div
            key={property.property_name}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4"
          >

            <div>

              <p className="font-semibold text-white">
                {property.property_name}
              </p>

              <p className="text-sm text-zinc-500">
                Occupied: {property.occupied_area_sqm} sqm
              </p>

            </div>

            <div className="text-right">

              <p className="text-sm text-zinc-400">
                Occupancy
              </p>

              <p className="font-semibold text-green-500">
                {property.occupancyPercentage}%
              </p>

            </div>

          </div>

        ))}

      </div>

    </div>

  </div>

  {/* RIGHT COLUMN */}

  <div className="space-y-8">

    {/* OPERATIONAL TASKS */}
<div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">

  <div className="mb-6 flex items-start">

    <div>

      <h2 className="text-2xl font-bold text-white">
        Critical Operational Tasks
      </h2>

      <p className="text-zinc-500 text-sm mt-1">
        Escalated operational workflows requiring attention.
      </p>

    </div>

    <Link
      href="/operations"
      className="ml-auto rounded-2xl border border-zinc-800 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:border-zinc-700"
    >

      View All

    </Link>

  </div>

  <div className="space-y-4">

        {criticalOperationalTasks.map((task) => (

          <div
            key={task.task_id}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4"
          >

            <div>

              <p className="font-semibold text-white">
                {task.task_type}
              </p>

              <p className="text-sm text-zinc-500">
                {task.property_name}
              </p>

            </div>

            <div className="text-right">

              <p className="text-sm text-zinc-400">
                Escalation Level
              </p>

              <p className="font-semibold text-red-500">
                Level {task.escalation_level}
              </p>

            </div>

          </div>

        ))}

      </div>

    </div>

    {/* EXECUTIVE ACTIONS */}

    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">

      <div className="mb-6">

        <h2 className="text-2xl font-bold text-white">
          Executive Action Center
        </h2>

        <p className="text-zinc-500 text-sm mt-1">
          Priority operational actions requiring leadership attention.
        </p>

      </div>

      <div className="space-y-4">

        {executiveActionItems.map((task) => (

          <div
            key={task.task_id}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4"
          >

            <div>

              <p className="font-semibold text-white">
                {task.task_type}
              </p>

              <p className="text-sm text-zinc-500">
                {task.property_name}
              </p>

            </div>

            <div className="text-right">

              <p className="text-sm text-zinc-400">
                Priority
              </p>

              <p
                className={`
                  font-semibold
                  ${
                    task.priority === "Critical"
                      ? "text-red-500"
                      : task.priority === "High"
                      ? "text-orange-500"
                      : "text-yellow-500"
                  }
                `}
              >

                {task.priority}

              </p>

            </div>

          </div>

        ))}

      </div>

    </div>

  </div>

</div>
const executiveInsights = [

  "Industrial portfolio renewal exposure has increased this quarter.",

  "Office occupancy performance remains below target thresholds.",

  "Renewal concentration risk is heavily weighted toward Q4 expiries.",

  "Operational task completion efficiency improved this month.",

];
const recommendedActions = [

  {
    title:
      "Initiate Office Portfolio Retention Strategy",
    description:
      "Occupancy performance has declined below target thresholds. Executive engagement recommended.",
  },

  {
    title:
      "Escalate Industrial Renewal Negotiations",
    description:
      "Multiple industrial lease renewals approaching expiry without finalized engagement.",
  },

  {
    title:
      "Review Vacancy Mitigation Incentives",
    description:
      "Consider strategic tenant retention incentives for high-risk assets.",
  },

];
const performanceTrends = [

  {
    metric: "Occupancy Performance",
    direction: "↑ Improving",
    value: "+4.2%",
    color: "text-green-600",
  },

  {
    metric: "Portfolio Revenue",
    direction: "↑ Growth",
    value: "+8.7%",
    color: "text-green-600",
  },

  {
    metric: "Renewal Exposure",
    direction: "↓ Reducing",
    value: "-3.1%",
    color: "text-blue-600",
  },

  {
    metric: "Task Completion Velocity",
    direction: "↑ Improving",
    value: "+12%",
    color: "text-orange-500",
  },

];
const portfolioHierarchy = [

  {
    portfolio: "Retail Portfolio",
    properties: [
      {
        name: "Sandton City",
        occupancy: "98%",
        leases: 42,
        risk: "Low",
      },
      {
        name: "Rosebank Mall",
        occupancy: "94%",
        leases: 28,
        risk: "Moderate",
      },
    ],
  },

  {
    portfolio: "Industrial Assets",
    properties: [
      {
        name: "Jet Park Distribution",
        occupancy: "89%",
        leases: 14,
        risk: "Moderate",
      },
      {
        name: "Midrand Logistics",
        occupancy: "91%",
        leases: 21,
        risk: "Low",
      },
    ],
  },

  {
    portfolio: "Office Portfolio",
    properties: [
      {
        name: "Lakewood Offices",
        occupancy: "82%",
        leases: 18,
        risk: "Critical",
      },
      {
        name: "Rivonia Corporate",
        occupancy: "86%",
        leases: 12,
        risk: "Moderate",
      },
    ],
  },

];

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

      <Breadcrumbs
  items={[
    {
      label: "Portfolio",
    },
    {
      label:
        "Portfolio",
    },
    {
      label: "Executive",
    },
  ]}
/>
<div className="mb-8 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-black p-8">

  <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

    <div>

      <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">

        Executive Workspace

      </p>

      <h1 className="text-5xl font-black tracking-tight text-white">

        Portfolio Command Center

      </h1>

      <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">

        Strategic operational oversight across portfolio performance,
        risk exposure,
        workflow execution,
        and executive intelligence.

      </p>
      <div className="mt-8 flex flex-wrap gap-4">

  <Link
  href="/leases/new"
  className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.02]"
>

  Create Lease

</Link>

 <Link
  href="/finance/arrears"
  className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:border-zinc-700"
>

  View Arrears

</Link>
<Link
  href="/operations"
  className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:border-zinc-700"
>

  Operational Tasks

</Link>

<Link
  href="/executive/reports"
  className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:border-zinc-700"
>

  Portfolio Report

</Link>

</div>

    </div>

    <div className="flex gap-3">

      <button className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200">

        Open Portfolio

      </button>

      <button className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white">

        Executive Reports

      </button>

    </div>

  </div>

</div>
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
          title="Resolved Tasks"
          value={resolvedTasks}
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
<KpiCard
  title="Total Properties"
  value={metrics.totalProperties}
  trend="Live portfolio asset count"
/>

<KpiCard
  title="Active Leases"
  value={metrics.activeLeases}
  trend="Currently active lease agreements"
/>

<KpiCard
  title="Arrears Exposure"
  value={`R ${metrics.totalArrearsExposure.toLocaleString()}`}
  valueColor="text-red-600"
  trend="Outstanding receivables exposure"
/>

<KpiCard
  title="Under-Recovery Exposure"
  value={`R ${metrics.totalUnderRecoveryExposure.toLocaleString()}`}
  valueColor="text-orange-500"
  trend="Operational recovery leakage"
/>

<KpiCard
  title="Critical Operational Tasks"
  value={metrics.criticalOperationalTasks}
  valueColor="text-red-500"
  trend="Escalated governance workflows"
/>

      </div>
      <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">

<div className="flex items-center justify-between mb-6">

  <div>

    <h2 className="text-2xl font-bold text-white">
      Critical Operational Tasks
    </h2>

    <p className="text-zinc-500 text-sm mt-1">
      Escalated operational workflows requiring attention.
    </p>

  </div>

  <Link
    href="/operations"
    className="rounded-2xl border border-zinc-800 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:border-zinc-700"
  >

    View All

  </Link>

</div>

  <div className="space-y-4">

    {criticalOperationalTasks.map((task) => (

      <div
        key={task.task_id}
        className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4"
      >

        <div>

          <p className="font-semibold text-white">

            {task.task_type}

          </p>

          <p className="text-sm text-zinc-500">

            {task.property_name}

          </p>

        </div>

        <div className="text-right">

          <p className="text-sm text-zinc-400">

            Escalation Level

          </p>

          <p className="font-semibold text-red-500">

            Level {task.escalation_level}

          </p>

        </div>

      </div>

    ))}

  </div>

</div>
      <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">

  <div className="flex items-center justify-between mb-6">

    <div>

      <h2 className="text-2xl font-bold text-white">

        Critical Lease Exposure

      </h2>

      <p className="text-zinc-500 text-sm mt-1">

        Active leases expiring within the next 90 days.

      </p>

    </div>
    <Link
  href="/leases"
  className="rounded-2xl border border-zinc-800 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:border-zinc-700"
>

  View All

</Link>

  </div>

  <div className="space-y-4">

    {criticalLeaseExposure.map((lease) => (

      <div
        key={lease.lease_id}
        className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4"
      >

        <div>

          <p className="font-semibold text-white">

            {lease.tenant_name}

          </p>

          <p className="text-sm text-zinc-500">

            {lease.property_name}

          </p>

        </div>

        <div className="text-right">

          <p className="text-sm text-zinc-400">

            Expiry Date

          </p>

          <p className="font-semibold text-red-500">

            {lease.expiry_date}

          </p>

        </div>

      </div>

    ))}

  </div>

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
<ExecutiveTimeline
  activities={activities || []}
/>
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
<div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">

  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

    <div>

      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Portfolio Context
      </p>

      <h2 className="text-2xl font-bold text-black">
        All Portfolios
      </h2>

      <p className="text-zinc-500 mt-2">
        Enterprise-wide operational visibility across all managed assets.
      </p>

    </div>

    <div className="flex flex-wrap gap-3">

      <button className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white">

        All Portfolios

      </button>

      <button className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">

        Retail Portfolio

      </button>

      <button className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">

        Industrial Assets

      </button>

      <button className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">

        Office Portfolio

      </button>

    </div>

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
<ExecutiveReportCenter />
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
<div className="mb-12 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">

  <div className="mb-6 flex items-center justify-between">

    <div>

      <p className="mb-3 text-sm uppercase tracking-[0.25em] text-zinc-500">

        Operational Accountability

      </p>

      <h2 className="text-3xl font-black text-white">

        Responsibility Assignments

      </h2>

    </div>

    <button className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200">

      + Assign Responsibility

    </button>

  </div>

  <div className="space-y-4">

    <div className="rounded-3xl border border-zinc-800 bg-black p-5">

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="rounded-3xl border border-zinc-800 bg-black p-5">

  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

    <div>

      <p className="text-sm uppercase tracking-[0.2em] text-blue-400 mb-2">

        Maintenance Workflow

      </p>

      <h3 className="text-2xl font-bold text-white mb-2">

        Lakewood Offices • HVAC Escalation

      </h3>

      <p className="text-zinc-400 leading-7">

        Maintenance escalation triggered after unresolved HVAC system failures
        affecting multiple tenants within the office block.

      </p>

    </div>

    <div className="flex flex-col gap-3">

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">

        Assigned To: Michael Daniels

      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">

        Due Date: 14 June 2026

      </div>

      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-300">

        Vendor Coordination Active

      </div>

    </div>

  </div>

</div>

        <div>

          <p className="text-sm uppercase tracking-[0.2em] text-orange-400 mb-2">

            Lease Renewal

          </p>

          <h3 className="text-2xl font-bold text-white mb-2">

            Sandton Gate • Renewal Engagement

          </h3>

          <p className="text-zinc-400 leading-7">

            Renewal engagement required before escalation threshold
            is reached for upcoming lease expiry.

          </p>

        </div>

        <div className="flex flex-col gap-3">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">

            Assigned To: Sarah Johnson

          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">

            Due Date: 12 June 2026

          </div>

          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-300">

            Pending Executive Review

          </div>

        </div>

      </div>

    </div>

  </div>

  <div className="mt-4 flex items-center gap-3">

  <div className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-black">

    Assigned

  </div>

  <div className="h-[2px] w-8 bg-zinc-700" />

  <div className="rounded-full bg-orange-400 px-3 py-1 text-xs font-bold text-black">

    In Progress

  </div>

  <div className="h-[2px] w-8 bg-zinc-700" />

  <div className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-400">

    Review

  </div>

  <div className="h-[2px] w-8 bg-zinc-700" />

  <div className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-400">

    Resolved

  </div>

</div>
<div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">

  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">

    <div>

      <p className="mb-2 text-sm uppercase tracking-[0.2em] text-red-300">

        Escalation Protocol

      </p>

      <p className="leading-7 text-zinc-400">

        If renewal engagement is not completed before the due date,
        the workflow will escalate to executive operations review.

      </p>

    </div>

    <div className="rounded-2xl border border-red-500/20 bg-black px-4 py-3 text-sm font-semibold text-red-300">

      Escalation Window: 3 Days Remaining

    </div>
    
  </div>
  <div className="flex flex-wrap gap-3">

  <button className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400">

    Escalate Now

  </button>

  <button className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white">

    Reassign Responsibility

  </button>

  <button className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white">

    Extend Due Date

  </button>

</div>

</div>

<div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">

  <p className="mb-5 text-sm uppercase tracking-[0.25em] text-zinc-500">

    Workflow Timeline

  </p>

  <div className="space-y-4">

    <div className="flex items-start gap-4">

      <div className="mt-1 h-3 w-3 rounded-full bg-emerald-400" />

      <div>

        <p className="font-semibold text-white">

          Responsibility Assigned

        </p>

        <p className="text-sm text-zinc-500">

          Assigned by Executive Operations • 08 June 2026 • 09:42

        </p>

      </div>

    </div>

    <div className="flex items-start gap-4">

      <div className="mt-1 h-3 w-3 rounded-full bg-orange-400" />

      <div>

        <p className="font-semibold text-white">

          Renewal Engagement Started

        </p>

        <p className="text-sm text-zinc-500">

          Asset manager initiated tenant engagement workflow.

        </p>

      </div>

    </div>

    <div className="flex items-start gap-4">

      <div className="mt-1 h-3 w-3 rounded-full bg-red-400" />

      <div>

        <p className="font-semibold text-white">

          Executive Review Pending

        </p>

        <p className="text-sm text-zinc-500">

          Workflow approaching escalation threshold window.

        </p>

      </div>

    </div>

  </div>

</div>
</div>

    </PageShell>
  );
}