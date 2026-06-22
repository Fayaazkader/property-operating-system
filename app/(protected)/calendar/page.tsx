import { supabase } from "../../lib/supabase";

export default async function CalendarPage() {

  const { data: leases } =
    await supabase
      .from("leases")
      .select("*");

  const upcomingItems: any[] = [];

  leases?.forEach((lease) => {

    if (lease.expiry_date) {

      upcomingItems.push({

        type: "Lease Expiry",

        tenant: lease.tenant_name,

        property: lease.property_name,

        date: lease.expiry_date,

      });
    }

    if (lease.escalation_date) {

      upcomingItems.push({

        type: "Escalation Review",

        tenant: lease.tenant_name,

        property: lease.property_name,

        date: lease.escalation_date,

      });
    }
  });

  upcomingItems.sort(
    (a, b) =>
      new Date(a.date).getTime() -
      new Date(b.date).getTime()
  );

  return (

    <main className="p-10 text-black">

      <div className="mb-10">

        <h1 className="text-4xl font-bold mb-3">
          Operational Calendar
        </h1>

        <p className="text-gray-500 text-lg">
          Upcoming operational milestones and critical portfolio dates.
        </p>

      </div>

      <div className="bg-white rounded-xl shadow p-6">

        <div className="space-y-4">

          {upcomingItems.length === 0 && (

            <p className="text-gray-500">
              No upcoming operational events.
            </p>

          )}

          {upcomingItems.map(
            (item, index) => (

              <div
                key={index}
                className="border rounded-xl p-5 flex justify-between items-center"
              >

                <div>

                  <p className="font-bold text-lg">
                    {item.type}
                  </p>

                  <p className="text-gray-600">
                    {item.tenant}
                  </p>

                  <p className="text-gray-400 text-sm">
                    {item.property}
                  </p>

                </div>

                <div className="text-right">

                  <p className="font-bold">
                    {item.date}
                  </p>

                </div>

              </div>

            )
          )}

        </div>

      </div>

    </main>
  );
}