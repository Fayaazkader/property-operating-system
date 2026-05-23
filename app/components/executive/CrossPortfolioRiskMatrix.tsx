export default function CrossPortfolioRiskMatrix() {

  return (

    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h2 className="text-2xl font-bold text-black">
            Cross-Portfolio Risk Matrix
          </h2>

          <p className="text-zinc-500 mt-2">
            Enterprise-wide operational exposure and portfolio vulnerability analysis.
          </p>

        </div>

        <span className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">

          Live Risk Monitoring

        </span>

      </div>

      <div className="space-y-6">

        <div>

          <div className="flex items-center justify-between mb-2">

            <div>

              <p className="font-bold text-black">
                Retail Portfolio
              </p>

              <p className="text-sm text-zinc-500">
                Stable occupancy and renewal exposure.
              </p>

            </div>

            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">

              LOW RISK

            </span>

          </div>

          <div className="h-3 rounded-full bg-zinc-100 overflow-hidden">

            <div className="h-full w-[25%] bg-green-500 rounded-full" />

          </div>

        </div>

        <div>

          <div className="flex items-center justify-between mb-2">

            <div>

              <p className="font-bold text-black">
                Industrial Assets
              </p>

              <p className="text-sm text-zinc-500">
                Moderate renewal concentration pressure.
              </p>

            </div>

            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">

              MODERATE

            </span>

          </div>

          <div className="h-3 rounded-full bg-zinc-100 overflow-hidden">

            <div className="h-full w-[58%] bg-orange-500 rounded-full" />

          </div>

        </div>

        <div>

          <div className="flex items-center justify-between mb-2">

            <div>

              <p className="font-bold text-black">
                Office Portfolio
              </p>

              <p className="text-sm text-zinc-500">
                Elevated vacancy and occupancy pressure detected.
              </p>

            </div>

            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">

              CRITICAL

            </span>

          </div>

          <div className="h-3 rounded-full bg-zinc-100 overflow-hidden">

            <div className="h-full w-[84%] bg-red-600 rounded-full" />

          </div>

        </div>

      </div>

    </div>

  );
}