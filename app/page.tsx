import { supabase } from "../lib/supabase";

export default async function Home() {

  const { data: leases } = await supabase
    .from("leases")
    .select("*");

  const totalLeases = leases?.length || 0;

  const highRiskLeases =
    leases?.filter(
      (lease) => lease.vacancy_risk === "High"
    ).length || 0;

  const criticalLeases =
    leases?.filter(
      (lease) => lease.vacancy_risk === "Critical"
    ).length || 0;

  const urgentRenewals =
    leases?.filter(
      (lease) =>
        lease.renewal_stage === "Urgent Renewal"
    ).length || 0;

  return (
    <main className="min-h-screen bg-gray-100">

      <div className="flex">

        {/* Sidebar */}
        <aside className="w-64 bg-black text-white min-h-screen p-6">

          <h1 className="text-2xl font-bold mb-10">
            Rentora
          </h1>

          <nav className="space-y-4">

            <div>Dashboard</div>
            <div>Leases</div>
            <div>Tasks</div>
            <div>Communications</div>
            <div>Notifications</div>
            <div>Analytics</div>

          </nav>

        </aside>

        {/* Main Content */}
        <section className="flex-1 p-10">

          <h2 className="text-3xl font-bold mb-6">
            Executive Dashboard
          </h2>


          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-6 mb-10">

            <div className="bg-white rounded-xl shadow p-6">

              <h3 className="text-gray-500 text-sm">
                Total Leases
              </h3>

              <p className="text-3xl font-bold mt-2">
                {totalLeases}
              </p>

            </div>

            <div className="bg-white rounded-xl shadow p-6">

              <h3 className="text-gray-500 text-sm">
                High Risk Leases
              </h3>

              <p className="text-3xl font-bold mt-2 text-orange-500">
                {highRiskLeases}
              </p>

            </div>

            <div className="bg-white rounded-xl shadow p-6">

              <h3 className="text-gray-500 text-sm">
                Critical Leases
              </h3>

              <p className="text-3xl font-bold mt-2 text-red-500">
                {criticalLeases}
              </p>

            </div>

            <div className="bg-white rounded-xl shadow p-6">

              <h3 className="text-gray-500 text-sm">
                Urgent Renewals
              </h3>

              <p className="text-3xl font-bold mt-2 text-blue-500">
                {urgentRenewals}
              </p>

            </div>

          </div>

          {/* Lease Table */}
          <div className="bg-white rounded-xl shadow p-6">

            <h3 className="text-xl font-bold mb-6">
              Lease Portfolio
            </h3>

            <table className="w-full">

              <thead>

                <tr className="border-b bg-gray-50">

                  <th className="text-left p-3">
                    Lease ID
                  </th>

                  <th className="text-left p-3">
                    Tenant
                  </th>

                  <th className="text-left p-3">
                    Property
                  </th>

                  <th className="text-left p-3">
                    Renewal Stage
                  </th>

                  <th className="text-left p-3">
                    Vacancy Risk
                  </th>

                </tr>

              </thead>

              <tbody>

                {leases?.map((lease) => (

                  <tr
                    key={lease.lease_id}
                    className="border-b hover:bg-gray-50"
                  >

                    <td className="p-3">
                      {lease.lease_id}
                    </td>

                    <td className="p-3">
                      {lease.tenant_name}
                    </td>

                    <td className="p-3">
                      {lease.property_name}
                    </td>

                    <td className="p-3">
                      {lease.renewal_stage}
                    </td>

                    <td className="p-3">
                      {lease.vacancy_risk}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </section>

      </div>

    </main>
  );
}