import { modules } from "@/app/config/modules";

export default function ModuleRegistry() {

  return (

    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8">

      <div className="mb-8">

        <p className="text-sm uppercase tracking-[0.25em] text-zinc-500 mb-3">

          Platform Infrastructure

        </p>

        <h2 className="text-3xl font-black text-white">

          Active Modules

        </h2>

        <p className="mt-3 text-zinc-400">

          Dynamically enabled operational platform capabilities.

        </p>

      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        {modules.map((module) => (

          <div
            key={module.id}
            className="rounded-2xl border border-zinc-800 bg-black p-6"
          >

            <div className="flex items-center justify-between mb-4">

              <p className="font-bold text-white">

                {module.label}

              </p>

              <span
                className={`
                  rounded-full
                  px-3
                  py-1
                  text-xs
                  font-bold
                  uppercase

                  ${
                    module.enabled
                      ? "bg-green-500/20 text-green-400"
                      : "bg-zinc-800 text-zinc-500"
                  }
                `}
              >

                {module.enabled
                  ? "Enabled"
                  : "Disabled"}

              </span>

            </div>

            <p className="text-sm text-zinc-500">

              Module ID:
              {" "}
              {module.id}

            </p>

          </div>

        ))}

      </div>

    </div>

  );
}