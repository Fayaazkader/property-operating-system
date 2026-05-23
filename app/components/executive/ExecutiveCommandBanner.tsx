export default function ExecutiveCommandBanner() {

  return (

    <div className="rounded-3xl bg-linear-to-r from-black via-zinc-900 to-black p-8 text-white shadow-sm border border-zinc-800">

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-8">

        <div>

          <p className="text-sm uppercase tracking-[0.25em] text-zinc-400 mb-3">
            Executive Command Center
          </p>

          <h1 className="text-4xl font-black mb-4">
            Live Operational Intelligence
          </h1>

          <p className="text-zinc-400 text-lg max-w-3xl leading-8">

            Centralized enterprise oversight across portfolios, operational workflows, renewals, risk exposure, and executive intelligence systems.

          </p>

        </div>

        <div className="grid grid-cols-2 gap-4 min-w-[320px]">

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">

            <p className="text-xs uppercase tracking-[0.15em] text-zinc-400 mb-2">
              System Status
            </p>

            <p className="text-2xl font-black text-green-400">
              Stable
            </p>

          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">

            <p className="text-xs uppercase tracking-[0.15em] text-zinc-400 mb-2">
              Intelligence Layer
            </p>

            <p className="text-2xl font-black">
              Active
            </p>

          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">

            <p className="text-xs uppercase tracking-[0.15em] text-zinc-400 mb-2">
              Portfolios
            </p>

            <p className="text-2xl font-black">
              3
            </p>

          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">

            <p className="text-xs uppercase tracking-[0.15em] text-zinc-400 mb-2">
              Operational Mode
            </p>

            <p className="text-2xl font-black text-blue-400">
              Live
            </p>

          </div>

        </div>

      </div>

    </div>

  );
}