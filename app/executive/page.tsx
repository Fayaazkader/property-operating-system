"use client";
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
import AppShell from "@/app/components/layout/AppShell";
import { usePlatform } from "../context/PlatformContext";
import Breadcrumbs from "../components/navigation/Breadcrumbs";

export default function ExecutivePage() {
const { activeCompany } =
  usePlatform();

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
        task.status !== "Completed"
    ).length || 0;

  const completedTasks =
    tasks?.filter(
      (task) =>
        task.status === "Completed"
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

];
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
    <AppShell>

    <PageShell>

      <Breadcrumbs
  items={[
    {
      label: "Portfolio",
    },
    {
      label:
        activeCompany.name,
    },
    {
      label: "Executive",
    },
  ]}
/>
      <PageHeader
        title="Executive Dashboard"
        subtitle="Strategic portfolio and operational intelligence."
      />

     <ExecutiveCommandBanner />
<ExecutiveSummaryBar
  leaseCount={leases?.length || 0}
  occupancyRate={occupancyRate}
  renewalCount={upcomingRenewals.length}
  portfolioRiskLevel={portfolioRiskLevel}
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
<ExecutivePriorities
  priorities={executivePriorities}
/>
      <Toolbar>

        <SearchInput />

        <div className="flex flex-wrap items-center gap-3">

          <ToolbarButton label="Export Report" />

          <ToolbarButton label="Filter Assets" />

          <ToolbarButton label="Generate Insights" />

        </div>

      </Toolbar>
 <PortfolioPerformanceTable />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

  <button className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm hover:bg-zinc-50 transition">

    <p className="text-sm text-zinc-500 mb-2">
      Operations
    </p>

    <p className="text-lg font-bold text-black">
      + Create Task
    </p>

  </button>

  <button className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm hover:bg-zinc-50 transition">

    <p className="text-sm text-zinc-500 mb-2">
      Portfolio
    </p>

    <p className="text-lg font-bold text-black">
      + Portfolio Note
    </p>

  </button>

  <button className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm hover:bg-zinc-50 transition">

    <p className="text-sm text-zinc-500 mb-2">
      Intelligence
    </p>

    <p className="text-lg font-bold text-black">
      + Generate Report
    </p>

  </button>

  <button className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm hover:bg-zinc-50 transition">

    <p className="text-sm text-zinc-500 mb-2">
      Renewals
    </p>

    <p className="text-lg font-bold text-black">
      + Renewal Review
    </p>

  </button>

</div>
<ExecutiveInsights
  insights={executiveInsights}
/>
<RecommendedActions
  actions={recommendedActions}

/>
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
    </PageShell>
    </AppShell>
  );
}