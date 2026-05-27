export default function OperationsPage() {

  return (

    <div className="p-8">

      <div className="mb-10 rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-zinc-900 to-black p-8">

        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

          <div>
<div className="mb-6 inline-flex items-center gap-3 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2">

  <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />

  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">

    Active Workspace

  </p>

</div>
<div className="mb-6 flex items-center gap-3 text-sm text-zinc-500">

  <button className="text-zinc-400 transition hover:text-white">

  Platform

</button>

  <span>

    →

  </span>

  <button className="text-zinc-400 transition hover:text-white">

  Operations

</button>

  <span>

    →

  </span>

  <span className="font-semibold text-white">

    Execution Governance

  </span>

</div>
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
<div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">

  <div className="mb-8 flex items-center justify-between">

    <div>

      <p className="mb-3 text-sm uppercase tracking-[0.25em] text-zinc-500">

        Live Operational Feed

      </p>

      <h2 className="text-4xl font-black text-white">

        Real-Time Execution Activity

      </h2>

    </div>

    <div className="flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2">

      <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />

      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-green-300">

        Live

      </p>

    </div>

  </div>

  <div className="space-y-4">

    <div className="rounded-3xl border border-zinc-800 bg-black p-5">

      <p className="text-sm text-zinc-500 mb-2">

        2 minutes ago

      </p>

      <p className="text-lg text-white">

        HVAC escalation assigned to Facilities Operations Team.

      </p>

    </div>

    <div className="rounded-3xl border border-zinc-800 bg-black p-5">

      <p className="text-sm text-zinc-500 mb-2">

        18 minutes ago

      </p>

      <p className="text-lg text-white">

        Sandton Gate lease renewal entered escalation workflow.

      </p>

    </div>

    <div className="rounded-3xl border border-zinc-800 bg-black p-5">

      <p className="text-sm text-zinc-500 mb-2">

        1 hour ago

      </p>

      <p className="text-lg text-white">

        Vendor compliance documentation uploaded and verified.

      </p>

    </div>

  </div>

</div>
<div className="mt-12 rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">

  <div className="mb-8">

    <p className="mb-3 text-sm uppercase tracking-[0.25em] text-zinc-500">

      Operational Accountability

    </p>

    <h2 className="text-4xl font-black text-white">

      Active Ownership & Governance

    </h2>

  </div>

  <div className="space-y-5">

    <div className="rounded-3xl border border-zinc-800 bg-black p-6">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-2xl font-bold text-white mb-2">

            Sandton Gate Renewal Escalation

          </p>

          <p className="text-zinc-400">

            Assigned to Asset Management Operations.

          </p>

        </div>

        <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2">

          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-300">

            Due In 3 Days

          </p>

        </div>

      </div>

    </div>

    <div className="rounded-3xl border border-zinc-800 bg-black p-6">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-2xl font-bold text-white mb-2">

            HVAC Vendor Resolution Workflow

          </p>

          <p className="text-zinc-400">

            Assigned to Facilities Coordination Team.

          </p>

        </div>

        <div className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2">

          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300">

            Escalated

          </p>

        </div>

      </div>

    </div>

  </div>

</div>
<div className="mt-12 rounded-[2rem] border border-red-500/20 bg-gradient-to-br from-red-500/10 to-black p-8">

  <div className="mb-8 flex items-center justify-between">

    <div>

      <p className="mb-3 text-sm uppercase tracking-[0.25em] text-red-300">

        Escalation Intelligence

      </p>

      <h2 className="text-4xl font-black text-white">

        Operational Exposure Monitoring

      </h2>

    </div>

    <div className="rounded-full border border-red-500/20 bg-red-500/10 px-5 py-3">

      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300">

        3 Critical Risks Active

      </p>

    </div>

  </div>

  <div className="grid gap-5 xl:grid-cols-3">

    <div className="rounded-3xl border border-red-500/20 bg-black/60 p-6">

      <p className="mb-3 text-sm uppercase tracking-[0.25em] text-red-300">

        Lease Exposure

      </p>

      <h3 className="mb-3 text-3xl font-black text-white">

        4 Renewals Delayed

      </h3>

      <p className="text-zinc-400 leading-7">

        Renewal engagement timelines exceeded governance threshold.

      </p>

    </div>

    <div className="rounded-3xl border border-yellow-500/20 bg-black/60 p-6">

      <p className="mb-3 text-sm uppercase tracking-[0.25em] text-yellow-300">

        Vendor Compliance

      </p>

      <h3 className="mb-3 text-3xl font-black text-white">

        2 Vendors Outstanding

      </h3>

      <p className="text-zinc-400 leading-7">

        Compliance verification pending operational review.

      </p>

    </div>

    <div className="rounded-3xl border border-blue-500/20 bg-black/60 p-6">

      <p className="mb-3 text-sm uppercase tracking-[0.25em] text-blue-300">

        Task Governance

      </p>

      <h3 className="mb-3 text-3xl font-black text-white">

        11 Tasks Overdue

      </h3>

      <p className="text-zinc-400 leading-7">

        Escalation intervention recommended for unresolved workflows.

      </p>

    </div>

  </div>

</div>
    </div>

  );
}