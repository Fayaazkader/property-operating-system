import { supabase } from "../../lib/supabase";

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
          (expiry.getTime() -
            today.getTime()) /
            (1000 *
              60 *
              60 *
              24)
        );

      return diffDays <= 30;

    }).length || 0;

  const openTasks =
    tasks?.filter(
      (task) =>
        task.status !==
        "Completed"
    ).length || 0;

  const completedTasks =
    tasks?.filter(
      (task) =>
        task.status ===
        "Completed"
    ).length || 0;

  return (

    <main className="p-10 text-black">

      <div className="mb-10">

        <h1 className="text-4xl font-bold mb-3">
          Executive Dashboard
        </h1>

        <p className="text-gray-500 text-lg">
          Strategic portfolio and operational intelligence.
        </p>

      </div>

      <div className="grid grid-cols-4 gap-6 mb-10">

        <div className="bg-white rounded-xl shadow p-6">

          <p className="text-gray-500 text-sm mb-2">
            Portfolio Revenue
          </p>

          <h2 className="text-4xl font-bold">
            R {totalRental.toLocaleString()}
          </h2>

        </div>

        <div className="bg-white rounded-xl shadow p-6">

          <p className="text-gray-500 text-sm mb-2">
            Critical Lease Risk
          </p>

          <h2 className="text-4xl font-bold text-red-600">
            {criticalLeases}
          </h2>

        </div>

        <div className="bg-white rounded-xl shadow p-6">

          <p className="text-gray-500 text-sm mb-2">
            Open Operational Tasks
          </p>

          <h2 className="text-4xl font-bold text-orange-500">
            {openTasks}
          </h2>

        </div>

        <div className="bg-white rounded-xl shadow p-6">

          <p className="text-gray-500 text-sm mb-2">
            Completed Tasks
          </p>

          <h2 className="text-4xl font-bold text-green-600">
            {completedTasks}
          </h2>

        </div>

      </div>

      <div className="grid grid-cols-2 gap-6">

        <div className="bg-white rounded-xl shadow p-8">

          <h2 className="text-2xl font-bold mb-6">
            Portfolio Health
          </h2>

          <div className="space-y-4">

            <div className="flex justify-between">

              <span>
                Stable Assets
              </span>

              <span className="font-bold text-green-600">
                Good
              </span>

            </div>

            <div className="flex justify-between">

              <span>
                Renewal Exposure
              </span>

              <span className="font-bold text-orange-500">
                Moderate
              </span>

            </div>

            <div className="flex justify-between">

              <span>
                Vacancy Threat
              </span>

              <span className="font-bold text-red-600">
                Monitored
              </span>

            </div>

          </div>

        </div>

        <div className="bg-white rounded-xl shadow p-8">

          <h2 className="text-2xl font-bold mb-6">
            Operational Focus
          </h2>

          <div className="space-y-4">

            <div className="border rounded-lg p-4">

              <p className="font-semibold">
                Renewal negotiations due
              </p>

            </div>

            <div className="border rounded-lg p-4">

              <p className="font-semibold">
                High-risk vacancy monitoring
              </p>

            </div>

            <div className="border rounded-lg p-4">

              <p className="font-semibold">
                Tenant engagement required
              </p>

            </div>

          </div>

        </div>

      </div>

    </main>
  );
}