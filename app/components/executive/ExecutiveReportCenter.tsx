export default function ExecutiveReportCenter() {

  return (

    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h2 className="text-2xl font-bold text-black">
            Executive Report Center
          </h2>

          <p className="text-zinc-500 mt-2">
            Generate operational, financial, and portfolio intelligence reports.
          </p>

        </div>

        <button className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white">

          Generate All Reports

        </button>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="rounded-2xl border border-zinc-200 p-6">

          <p className="text-lg font-bold text-black mb-2">
            Monthly Executive Summary
          </p>

          <p className="text-sm text-zinc-500 mb-5">
            Strategic operational and portfolio performance overview.
          </p>

          <button className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">

            Generate Report

          </button>

        </div>

        <div className="rounded-2xl border border-zinc-200 p-6">

          <p className="text-lg font-bold text-black mb-2">
            Renewal Exposure Analysis
          </p>

          <p className="text-sm text-zinc-500 mb-5">
            Upcoming lease expiry and renewal risk reporting.
          </p>

          <button className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">

            Generate Report

          </button>

        </div>

        <div className="rounded-2xl border border-zinc-200 p-6">

          <p className="text-lg font-bold text-black mb-2">
            Operational Risk Report
          </p>

          <p className="text-sm text-zinc-500 mb-5">
            Portfolio operational exposure and risk intelligence.
          </p>

          <button className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">

            Generate Report

          </button>

        </div>

        <div className="rounded-2xl border border-zinc-200 p-6">

          <p className="text-lg font-bold text-black mb-2">
            Occupancy Performance
          </p>

          <p className="text-sm text-zinc-500 mb-5">
            Occupancy trends and vacancy exposure reporting.
          </p>

          <button className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">

            Generate Report

          </button>

        </div>

      </div>

    </div>

  );
}