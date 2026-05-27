export default function OperationsPage() {

  return (

    <div className="p-8">

      <div className="mb-10 rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-900 to-black p-8">

        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

          <div>

            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">

              Operations Workspace

            </p>

            <h1 className="text-5xl font-black tracking-tight text-white">

              Operational Execution Center

            </h1>

            <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">

              Workflow coordination,
              operational accountability,
              escalations,
              maintenance governance,
              and execution oversight across the portfolio.

            </p>

          </div>

          <div className="flex gap-3">

            <button className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200">

              Create Workflow

            </button>

            <button className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white">

              Escalation Queue

            </button>

          </div>

        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">

        <button className="group rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-800">

          <p className="mb-3 text-sm uppercase tracking-[0.25em] text-zinc-500">

            Accountability

          </p>

          <h3 className="mb-3 text-2xl font-black text-white">

            Assignments

          </h3>

          <p className="text-sm leading-7 text-zinc-400">

            Manage operational ownership,
            workflow assignments,
            and execution tracking.

          </p>

        </button>

        <button className="group rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-800">

          <p className="mb-3 text-sm uppercase tracking-[0.25em] text-zinc-500">

            Governance

          </p>

          <h3 className="mb-3 text-2xl font-black text-white">

            Escalations

          </h3>

          <p className="text-sm leading-7 text-zinc-400">

            Monitor overdue execution,
            escalation pathways,
            and operational intervention.

          </p>

        </button>

      </div>

      <div className="mb-12 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">

        <div className="mb-8">

          <p className="mb-3 text-sm uppercase tracking-[0.25em] text-zinc-500">

            Active Operations Queue

          </p>

          <h2 className="text-4xl font-black text-white">

            Live Execution Workflows

          </h2>

        </div>

        <div className="space-y-4">

          <div className="rounded-3xl border border-zinc-800 bg-black p-5">

            <h3 className="text-2xl font-bold text-white mb-2">

              Sandton Gate • Renewal Escalation

            </h3>

            <p className="text-zinc-400">

              Renewal engagement awaiting tenant confirmation.

            </p>

          </div>

          <div className="rounded-3xl border border-zinc-800 bg-black p-5">

            <h3 className="text-2xl font-bold text-white mb-2">

              Lakewood Offices • HVAC Resolution

            </h3>

            <p className="text-zinc-400">

              Vendor coordination active following escalation.

            </p>

          </div>

        </div>

      </div>

    </div>

  );
}