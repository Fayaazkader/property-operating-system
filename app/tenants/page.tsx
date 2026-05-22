import { supabase } from "../../lib/supabase";

export default async function TenantsPage() {

  const { data: tenants } =
    await supabase
      .from("tenants")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

  return (

    <main className="p-10 text-black">

      <div className="flex justify-between items-center mb-10">

        <h1 className="text-4xl font-bold">
          Tenant CRM
        </h1>

      </div>

      <div className="bg-white rounded-xl shadow p-6 overflow-auto">

        <table className="w-full">

          <thead>

            <tr className="border-b text-left">

              <th className="p-4">
                Tenant
              </th>

              <th className="p-4">
                Contact Person
              </th>

              <th className="p-4">
                Email
              </th>

              <th className="p-4">
                Phone
              </th>

              <th className="p-4">
                Industry
              </th>

              <th className="p-4">
                Risk Rating
              </th>

            </tr>

          </thead>

          <tbody>

            {tenants?.map((tenant) => (

              <tr
                key={tenant.id}
                className="border-b hover:bg-gray-50"
              >

                <td className="p-4 font-semibold">
                  {tenant.tenant_name}
                </td>

                <td className="p-4">
                  {tenant.contact_person}
                </td>

                <td className="p-4">
                  {tenant.email}
                </td>

                <td className="p-4">
                  {tenant.phone}
                </td>

                <td className="p-4">
                  {tenant.industry}
                </td>

                <td className="p-4">

                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold
                    ${
                      tenant.risk_rating === "High"
                        ? "bg-red-100 text-red-700"
                        : tenant.risk_rating === "Medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {tenant.risk_rating}
                  </span>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </main>
  );
}