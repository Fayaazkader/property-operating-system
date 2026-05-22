import { supabase } from "../../lib/supabase";

export default async function NotificationsPage() {

  const { data: leases } =
    await supabase
      .from("leases")
      .select("*");

  const { data: tasks } =
    await supabase
      .from("tasks")
      .select("*");

  const notifications: {
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
          (1000 *
            60 *
            60 *
            24)
      );

    if (diffDays <= 30) {

      notifications.push({

        type: "critical",

        message:
          `${lease.tenant_name} lease expires within 30 days.`,
      });

    } else if (diffDays <= 90) {

      notifications.push({

        type: "warning",

        message:
          `${lease.tenant_name} renewal engagement required.`,
      });
    }

    if (
      lease.vacancy_risk ===
      "Critical"
    ) {

      notifications.push({

        type: "risk",

        message:
          `${lease.tenant_name} marked as critical vacancy exposure.`,
      });
    }

  });

  tasks?.forEach((task) => {

    if (
      task.status !==
      "Completed"
    ) {

      notifications.push({

        type: "task",

        message:
          `Outstanding operational task: ${task.task_title}`,
      });
    }

  });

  return (

    <main className="p-10 text-black">

      <div className="mb-10">

        <h1 className="text-4xl font-bold mb-3">
          Notifications Center
        </h1>

        <p className="text-gray-500 text-lg">
          Real-time operational alerts and executive intelligence.
        </p>

      </div>

      <div className="bg-white rounded-xl shadow p-6">

        <div className="flex justify-between items-center mb-8">

          <h2 className="text-2xl font-bold">
            Active Notifications
          </h2>

          <span className="bg-black text-white px-4 py-2 rounded-full text-sm font-bold">
            {notifications.length} Active
          </span>

        </div>

        <div className="space-y-4">

          {notifications.length === 0 && (

            <p className="text-gray-500">
              No active operational notifications.
            </p>

          )}

          {notifications.map(
            (notification, index) => (

              <div
                key={index}
                className={`border-l-4 rounded-lg p-5
                ${
                  notification.type === "critical"
                    ? "bg-red-50 border-red-500"
                    : notification.type === "warning"
                    ? "bg-orange-50 border-orange-500"
                    : notification.type === "risk"
                    ? "bg-yellow-50 border-yellow-500"
                    : "bg-blue-50 border-blue-500"
                }`}
              >

                <p className="font-semibold text-lg">
                  {notification.message}
                </p>

              </div>

            )
          )}

        </div>

      </div>

    </main>
  );
}