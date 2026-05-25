import { actions } from "@/app/config/actions";

export default function ActionCenter() {

  return (

    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8">

      <div className="mb-8">

        <p className="text-sm uppercase tracking-[0.25em] text-zinc-500 mb-3">

          Operational Actions

        </p>

        <h2 className="text-3xl font-black text-white">

          Action Center

        </h2>

        <p className="mt-3 text-zinc-400">

          Centralized operational command execution across the platform.

        </p>

      </div>

      <div className="grid gap-4 lg:grid-cols-2">

        {actions.map((action) => (

          <button
            key={action.id}
            className="rounded-2xl border border-zinc-800 bg-black p-6 text-left transition hover:border-zinc-700 hover:bg-zinc-950"
          >

            <p className="text-lg font-bold text-white">

              {action.title}

            </p>

            <p className="mt-3 text-zinc-400 leading-7">

              {action.description}

            </p>

            <div className="mt-5">

              <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">

                {action.workspace}

              </span>

            </div>

          </button>

        ))}

      </div>

    </div>

  );
}