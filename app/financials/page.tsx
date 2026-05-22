import { supabase } from "../../lib/supabase";

export default async function FinancialsPage() {

  const { data: financials } =
    await supabase
      .from("financials")
      .select("*");

  const totalOutstanding =
    financials?.reduce(
      (sum, item) =>
        sum +
        (item.outstanding_balance || 0),
      0
    ) || 0;

  const overdueAccounts =
    financials?.filter(
      (item) =>
        item.payment_status ===
        "Overdue"
    ).length || 0;

  const currentAccounts =
    financials?.filter(
      (item) =>
        item.payment_status ===
        "Current"
    ).length || 0;

  return (

    <main className="p-10 text-black">

      <div className="mb-10">

        <h1 className="text-4xl font-bold mb-3">
          Financial Operations
        </h1>

        <p className="text-gray-500 text-lg">
          Portfolio financial exposure and collections intelligence.
        </p>

      </div>

      <div className="grid grid-cols-3 gap-6 mb-10">

        <div className="bg-white rounded-xl shadow p-6">

          <p className="text-gray-500 text-sm mb-2">
            Outstanding Exposure
          </p>

          <h2 className="text-4xl font-bold text-red-600">
            R {totalOutstanding.toLocaleString()}
          </h2>

        </div>

        <div className="bg-white rounded-xl shadow p-6">

          <p className="text-gray-500 text-sm mb-2">
            Overdue Accounts
          </p>

          <h2 className="text-4xl font-bold text-orange-500">
            {overdueAccounts}
          </h2>

        </div>

        <div className="bg-white rounded-xl shadow p-6">

          <p className="text-gray-500 text-sm mb-2">
            Current Accounts
          </p>

          <h2 className="text-4xl font-bold text-green-600">
            {currentAccounts}
          </h2>

        </div>

      </div>

      <div className="bg-white rounded-xl shadow p-6 overflow-auto">

        <h2 className="text-2xl font-bold mb-6">
          Tenant Financial Exposure
        </h2>

        <table className="w-full">

          <thead>

            <tr className="border-b text-left">

              <th className="p-4">
                Tenant
              </th>

              <th className="p-4">
                Monthly Rental
              </th>

              <th className="p-4">
                Outstanding Balance
              </th>

              <th className="p-4">
                Payment Status
              </th>

              <th className="p-4">
                Next Escalation
              </th>

            </tr>

          </thead>

          <tbody>

            {financials?.map((item) => (

              <tr
                key={item.id}
                className="border-b hover:bg-gray-50"
              >

                <td className="p-4 font-semibold">
                  {item.tenant_name}
                </td>

                <td className="p-4">
                  R {item.monthly_rental}
                </td>

                <td className="p-4">
                  R {item.outstanding_balance}
                </td>

                <td className="p-4">

                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold
                    ${
                      item.payment_status === "Overdue"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {item.payment_status}
                  </span>

                </td>

                <td className="p-4">
                  {item.next_escalation_date}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </main>
  );
}