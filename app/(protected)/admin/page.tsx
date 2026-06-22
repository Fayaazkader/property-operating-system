import { supabase } from "@/lib/supabase";

export default async function AdminPage() {

  const { data: users } =
    await supabase
      .from("user_roles")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

  return (

    <main className="p-10 text-black">

      <div className="mb-10">

        <h1 className="text-4xl font-bold mb-3">
          Admin Console
        </h1>

        <p className="text-gray-500 text-lg">
          Platform governance and user administration.
        </p>

      </div>

      <div className="grid grid-cols-3 gap-6 mb-10">

        <div className="bg-white rounded-xl shadow p-6">

          <p className="text-gray-500 text-sm mb-2">
            Total Users
          </p>

          <h2 className="text-4xl font-bold">
            {users?.length || 0}
          </h2>

        </div>

        <div className="bg-white rounded-xl shadow p-6">

          <p className="text-gray-500 text-sm mb-2">
            Admin Users
          </p>

          <h2 className="text-4xl font-bold text-red-600">

            {
              users?.filter(
                (u) =>
                  u.role === "Admin"
              ).length || 0
            }

          </h2>

        </div>

        <div className="bg-white rounded-xl shadow p-6">

          <p className="text-gray-500 text-sm mb-2">
            Asset Managers
          </p>

          <h2 className="text-4xl font-bold text-blue-600">

            {
              users?.filter(
                (u) =>
                  u.role ===
                  "Asset Manager"
              ).length || 0
            }

          </h2>

        </div>

      </div>

      <div className="bg-white rounded-xl shadow p-6 overflow-auto">

        <h2 className="text-2xl font-bold mb-6">
          User Access Management
        </h2>

        <table className="w-full">

          <thead>

            <tr className="border-b text-left">

              <th className="p-4">
                User Email
              </th>

              <th className="p-4">
                Role
              </th>

              <th className="p-4">
                Created
              </th>

            </tr>

          </thead>

          <tbody>

            {users?.map((user) => (

              <tr
                key={user.id}
                className="border-b hover:bg-gray-50"
              >

                <td className="p-4 font-semibold">
                  {user.user_email}
                </td>

                <td className="p-4">

                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold ${
                      user.role === "Admin"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {user.role}
                  </span>

                </td>

                <td className="p-4">
                  {new Date(
                    user.created_at
                  ).toLocaleDateString()}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </main>
  );
}