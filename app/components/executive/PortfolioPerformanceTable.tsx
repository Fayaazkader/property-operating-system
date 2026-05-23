export default function PortfolioPerformanceTable() {

  return (

    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h2 className="text-2xl font-bold text-black">
            Portfolio Performance
          </h2>

          <p className="text-zinc-500 mt-2">
            Comparative operational and financial portfolio intelligence.
          </p>

        </div>

        <button className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">

          Export Portfolio View

        </button>

      </div>

      <div className="overflow-x-auto">

        <table className="w-full">

          <thead>

            <tr className="border-b border-zinc-200">

              <th className="text-left py-4 text-sm font-semibold text-zinc-500 uppercase">
                Portfolio
              </th>

              <th className="text-left py-4 text-sm font-semibold text-zinc-500 uppercase">
                Revenue
              </th>

              <th className="text-left py-4 text-sm font-semibold text-zinc-500 uppercase">
                Occupancy
              </th>

              <th className="text-left py-4 text-sm font-semibold text-zinc-500 uppercase">
                Risk
              </th>

              <th className="text-left py-4 text-sm font-semibold text-zinc-500 uppercase">
                Renewals
              </th>

              <th className="text-left py-4 text-sm font-semibold text-zinc-500 uppercase">
                Status
              </th>

            </tr>

          </thead>

          <tbody>

            <tr className="border-b border-zinc-100">

              <td className="py-5 font-semibold text-black">
                Retail Portfolio
              </td>

              <td className="py-5 text-zinc-700">
                R 4,250,000
              </td>

              <td className="py-5 text-zinc-700">
                96%
              </td>

              <td className="py-5">

                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">

                  Stable

                </span>

              </td>

              <td className="py-5 text-zinc-700">
                4 Upcoming
              </td>

              <td className="py-5">

                <span className="rounded-full bg-black px-3 py-1 text-xs font-bold text-white">

                  Performing

                </span>

              </td>

            </tr>

            <tr className="border-b border-zinc-100">

              <td className="py-5 font-semibold text-black">
                Industrial Assets
              </td>

              <td className="py-5 text-zinc-700">
                R 7,820,000
              </td>

              <td className="py-5 text-zinc-700">
                91%
              </td>

              <td className="py-5">

                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">

                  Moderate

                </span>

              </td>

              <td className="py-5 text-zinc-700">
                9 Upcoming
              </td>

              <td className="py-5">

                <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white">

                  Watchlist

                </span>

              </td>

            </tr>

            <tr>

              <td className="py-5 font-semibold text-black">
                Office Portfolio
              </td>

              <td className="py-5 text-zinc-700">
                R 3,140,000
              </td>

              <td className="py-5 text-zinc-700">
                82%
              </td>

              <td className="py-5">

                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">

                  Critical

                </span>

              </td>

              <td className="py-5 text-zinc-700">
                11 Upcoming
              </td>

              <td className="py-5">

                <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">

                  Intervention

                </span>

              </td>

            </tr>

          </tbody>

        </table>

      </div>

    </div>

  );
}