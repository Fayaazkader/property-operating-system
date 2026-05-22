import Link from "next/link";

import { supabase } from "../../lib/supabase";

export default async function LeasesPage() {

  const { data: leases } =
    await supabase
      .from("leases")
      .select("*");

  const totalLeases =
    leases?.length || 0;

  const totalMonthlyRental =
    leases?.reduce(
      (sum, lease) =>
        sum +
        (lease.monthly_rental || 0),
      0
    ) || 0;

  const highRiskLeases =
    leases?.filter(
      (lease) =>
        lease.vacancy_risk === "High" ||
        lease.vacancy_risk === "Critical"
    ).length || 0;

  const expiringSoon =
    leases?.filter((lease) => {

      if (!lease.expiry_date)
        return false;

      const expiry =
        new Date(lease.expiry_date);

      const today =
        new Date();

      const diffDays =
        (expiry.getTime() -
          today.getTime()) /
        (1000 * 60 * 60 * 24);

      return diffDays <= 90;

    }).length || 0;

  const alerts: {
    type: string;
    message: string;
  }[] = [];

  leases?.forEach((lease) => {

    if (!lease.expiry_date)
      return;

    const expiry =
      new Date(lease.expiry_date);

    const today =
      new Date();

    const diffDays =
      Math.ceil(
        (expiry.getTime() -
          today.getTime()) /
        (1000 * 60 * 60 * 24)
      );

    if (diffDays <= 30) {

      alerts.push({
        type: "critical",
        message:
          `${lease.tenant_name} expires in ${diffDays} days`,
      });

    } else if (diffDays <= 90) {

      alerts.push({
        type: "warning",
        message:
          `${lease.tenant_name} renewal required soon`,
      });
    }

    if (
      lease.vacancy_risk === "High" ||
      lease.vacancy_risk === "Critical"
    ) {

      alerts.push({
        type: "risk",
        message:
          `${lease.tenant_name} marked as high vacancy risk`,
      });
    }
  });

  let stableCount = 0;
  let monitorCount = 0;
  let renewalPendingCount = 0;
  let criticalCount = 0;

  leases?.forEach((lease) => {

    if (!lease.expiry_date) {

      stableCount++;
      return;
    }

    const expiry =
      new Date(lease.expiry_date);

    const today =
      new Date();

    const diffDays =
      Math.ceil(
        (expiry.getTime() -
          today.getTime()) /
        (1000 * 60 * 60 * 24)
      );

    if (diffDays <= 30) {

      criticalCount++;

    } else if (diffDays <= 90) {

      renewalPendingCount++;

    } else if (diffDays <= 180) {

      monitorCount++;

    } else {

      stableCount++;
    }
  });

  const aiInsights: string[] = [];

  if (criticalCount >= 3) {

    aiInsights.push(
      "Portfolio has elevated critical lease exposure."
    );
  }

  if (highRiskLeases >= 3) {

    aiInsights.push(
      "High vacancy risk concentration detected."
    );
  }

  if (expiringSoon >= 5) {

    aiInsights.push(
      "Significant lease rollover concentration approaching."
    );
  }

  if (totalMonthlyRental > 1000000) {

    aiInsights.push(
      "Portfolio revenue exposure exceeds enterprise threshold."
    );
  }

  if (aiInsights.length === 0) {

    aiInsights.push(
      "Portfolio operational health currently stable."
    );
  }

  let expiry3Months = 0;
  let expiry6Months = 0;
  let expiry12Months = 0;

  leases?.forEach((lease) => {

    if (!lease.expiry_date)
      return;

    const expiry =
      new Date(lease.expiry_date);

    const today =
      new Date();

    const diffDays =
      Math.ceil(
        (expiry.getTime() -
          today.getTime()) /
        (1000 * 60 * 60 * 24)
      );

    if (diffDays <= 90) {

      expiry3Months++;
    }

    if (diffDays <= 180) {

      expiry6Months++;
    }

    if (diffDays <= 365) {

      expiry12Months++;
    }
  });

  return (

    <main className="p-10 text-black">

      <div className="flex justify-between items-center mb-10">

        <div>

          <h1 className="text-5xl font-black mb-3">
            Lease Dashboard
          </h1>

          <p className="text-gray-500 text-lg">
            Enterprise lease operations and portfolio intelligence.
          </p>

        </div>

        <Link
          href="/leases/new"
          className="bg-black text-white px-6 py-4 rounded-2xl font-semibold shadow-lg hover:opacity-90 transition-all"
        >
          Create Lease
        </Link>

      </div>

      <div className="grid grid-cols-4 gap-6 mb-10">

        <div className="bg-gradient-to-br from-black to-gray-800 text-white rounded-2xl shadow-lg p-8">

          <p className="text-gray-300 text-sm uppercase tracking-widest mb-3">
            Total Leases
          </p>

          <h2 className="text-5xl font-black mb-2">
            {totalLeases}
          </h2>

          <p className="text-gray-400 text-sm">
            Active portfolio agreements
          </p>

        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">

          <p className="text-gray-500 text-sm uppercase tracking-widest mb-3">
            Monthly Revenue
          </p>

          <h2 className="text-5xl font-black mb-2 text-green-600">
            R {totalMonthlyRental.toLocaleString()}
          </h2>

          <p className="text-gray-400 text-sm">
            Current monthly portfolio income
          </p>

        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">

          <p className="text-gray-500 text-sm uppercase tracking-widest mb-3">
            High Risk Exposure
          </p>

          <h2 className="text-5xl font-black mb-2 text-red-600">
            {highRiskLeases}
          </h2>

          <p className="text-gray-400 text-sm">
            Critical vacancy monitoring
          </p>

        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">

          <p className="text-gray-500 text-sm uppercase tracking-widest mb-3">
            Expiring Soon
          </p>

          <h2 className="text-5xl font-black mb-2 text-orange-500">
            {expiringSoon}
          </h2>

          <p className="text-gray-400 text-sm">
            Renewals within 90 days
          </p>

        </div>

      </div>

      <div className="bg-black text-white rounded-2xl shadow-lg p-8 mb-10">

        <div className="flex justify-between items-center mb-6">

          <h2 className="text-3xl font-black">
            AI Portfolio Insights
          </h2>

          <span className="bg-white text-black px-4 py-2 rounded-full text-xs uppercase tracking-widest font-bold">
            Intelligence Engine
          </span>

        </div>

        <div className="space-y-4">

          {aiInsights.map(
            (insight, index) => (

              <div
                key={index}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5"
              >

                <p className="text-lg">
                  {insight}
                </p>

              </div>

            )
          )}

        </div>

      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 mb-10">

        <h2 className="text-3xl font-black mb-8">
          Portfolio Forecasting
        </h2>

        <div className="grid grid-cols-3 gap-6">

          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">

            <p className="text-red-700 text-sm uppercase tracking-wide mb-3 font-bold">
              Expiring in 3 Months
            </p>

            <h3 className="text-5xl font-black text-red-800">
              {expiry3Months}
            </h3>

          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">

            <p className="text-orange-700 text-sm uppercase tracking-wide mb-3 font-bold">
              Expiring in 6 Months
            </p>

            <h3 className="text-5xl font-black text-orange-800">
              {expiry6Months}
            </h3>

          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">

            <p className="text-yellow-700 text-sm uppercase tracking-wide mb-3 font-bold">
              Expiring in 12 Months
            </p>

            <h3 className="text-5xl font-black text-yellow-800">
              {expiry12Months}
            </h3>

          </div>

        </div>

      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 mb-10">

        <div className="flex justify-between items-center mb-6">

          <h2 className="text-3xl font-black">
            Operational Alerts
          </h2>

          <span className="bg-red-100 text-red-700 px-4 py-2 rounded-full font-bold text-sm">
            {alerts.length} Active
          </span>

        </div>

        <div className="space-y-4">

          {alerts.length === 0 && (

            <p className="text-gray-500">
              No active operational alerts.
            </p>

          )}

          {alerts.map(
            (alert, index) => (

              <div
                key={index}
                className={`border-l-4 rounded-2xl p-5 ${
                  alert.type === "critical"
                    ? "bg-red-50 border-red-500"
                    : alert.type === "warning"
                    ? "bg-orange-50 border-orange-500"
                    : "bg-yellow-50 border-yellow-500"
                }`}
              >

                <p className="font-semibold text-lg">
                  {alert.message}
                </p>

              </div>

            )
          )}

        </div>

      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 mb-10">

        <h2 className="text-3xl font-black mb-8">
          Portfolio Risk Distribution
        </h2>

        <div className="grid grid-cols-4 gap-6">

          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">

            <p className="text-green-700 text-sm uppercase tracking-wide mb-3 font-bold">
              Stable
            </p>

            <h3 className="text-5xl font-black text-green-800">
              {stableCount}
            </h3>

          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">

            <p className="text-yellow-700 text-sm uppercase tracking-wide mb-3 font-bold">
              Monitor
            </p>

            <h3 className="text-5xl font-black text-yellow-800">
              {monitorCount}
            </h3>

          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">

            <p className="text-orange-700 text-sm uppercase tracking-wide mb-3 font-bold">
              Renewal Pending
            </p>

            <h3 className="text-5xl font-black text-orange-800">
              {renewalPendingCount}
            </h3>

          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">

            <p className="text-red-700 text-sm uppercase tracking-wide mb-3 font-bold">
              Critical
            </p>

            <h3 className="text-5xl font-black text-red-800">
              {criticalCount}
            </h3>

          </div>

        </div>

      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 overflow-auto">

        <h2 className="text-3xl font-black mb-8">
          Lease Portfolio
        </h2>

        <table className="w-full">

          <thead>

            <tr className="border-b border-gray-200 text-left">

              <th className="p-4 text-sm uppercase tracking-wide text-gray-500">
                Lease ID
              </th>

              <th className="p-4 text-sm uppercase tracking-wide text-gray-500">
                Tenant
              </th>

              <th className="p-4 text-sm uppercase tracking-wide text-gray-500">
                Property
              </th>

              <th className="p-4 text-sm uppercase tracking-wide text-gray-500">
                Monthly Rental
              </th>

              <th className="p-4 text-sm uppercase tracking-wide text-gray-500">
                Vacancy Risk
              </th>

              <th className="p-4 text-sm uppercase tracking-wide text-gray-500">
                Workflow Status
              </th>

              <th className="p-4 text-sm uppercase tracking-wide text-gray-500">
                Lease Health
              </th>

            </tr>

          </thead>

          <tbody>

            {leases?.map((lease) => {

              let workflowStatus =
                "Stable";

              let workflowClass =
                "bg-green-100 text-green-700";

              if (lease.expiry_date) {

                const expiry =
                  new Date(lease.expiry_date);

                const today =
                  new Date();

                const diffDays =
                  Math.ceil(
                    (expiry.getTime() -
                      today.getTime()) /
                    (1000 * 60 * 60 * 24)
                  );

                if (diffDays <= 30) {

                  workflowStatus =
                    "Critical Action";

                  workflowClass =
                    "bg-red-100 text-red-700";

                } else if (diffDays <= 90) {

                  workflowStatus =
                    "Renewal Pending";

                  workflowClass =
                    "bg-orange-100 text-orange-700";

                } else if (diffDays <= 180) {

                  workflowStatus =
                    "Monitor";

                  workflowClass =
                    "bg-yellow-100 text-yellow-700";
                }
              }

              let leaseHealth = 100;

              if (
                lease.vacancy_risk === "High"
              ) {

                leaseHealth -= 35;
              }

              if (
                lease.vacancy_risk === "Critical"
              ) {

                leaseHealth -= 50;
              }

              if (lease.expiry_date) {

                const expiry =
                  new Date(lease.expiry_date);

                const today =
                  new Date();

                const diffDays =
                  Math.ceil(
                    (expiry.getTime() -
                      today.getTime()) /
                    (1000 * 60 * 60 * 24)
                  );

                if (diffDays <= 30) {

                  leaseHealth -= 40;

                } else if (diffDays <= 90) {

                  leaseHealth -= 25;

                } else if (diffDays <= 180) {

                  leaseHealth -= 10;
                }
              }

              return (

                <tr
                  key={lease.lease_id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-all"
                >

                  <td className="p-4">

                    <Link
                      href={`/leases/${lease.lease_id}`}
                      className="font-bold underline"
                    >
                      {lease.lease_id}
                    </Link>

                  </td>

                  <td className="p-4">

                    <div>

                      <p className="font-bold text-gray-900">
                        {lease.tenant_name}
                      </p>

                      <p className="text-xs text-gray-400 mt-1">
                        Enterprise Tenant
                      </p>

                    </div>

                  </td>

                  <td className="p-4">

                    <div>

                      <p className="font-semibold text-gray-800">
                        {lease.property_name}
                      </p>

                      <p className="text-xs text-gray-400 mt-1">
                        Managed Asset
                      </p>

                    </div>

                  </td>

                  <td className="p-4 font-semibold">
                    R {lease.monthly_rental}
                  </td>

                  <td className="p-4">
                    {lease.vacancy_risk}
                  </td>

                  <td className="p-4">

                    <span
                      className={`${workflowClass} px-4 py-2 rounded-full text-xs uppercase tracking-wide font-bold shadow-sm`}
                    >
                      {workflowStatus}
                    </span>

                  </td>

                  <td className="p-4">

                    <span
                      className={`px-4 py-2 rounded-full text-xs uppercase tracking-wide font-bold shadow-sm ${
                        leaseHealth >= 90
                          ? "bg-green-100 text-green-700"
                          : leaseHealth >= 70
                          ? "bg-blue-100 text-blue-700"
                          : leaseHealth >= 50
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {leaseHealth}%
                    </span>

                  </td>

                </tr>

              );
            })}

          </tbody>

        </table>

      </div>

    </main>
  );
}