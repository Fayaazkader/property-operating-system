import Link from "next/link";

import { workspaces } from "@/app/config/workspaces";

export default function WorkspaceRegistry() {

  return (

    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8">

      <div className="mb-8">

        <p className="text-sm uppercase tracking-[0.25em] text-zinc-500 mb-3">

          Workspace System

        </p>

        <h2 className="text-3xl font-black text-white">

          Operational Workspaces

        </h2>

        <p className="mt-3 text-zinc-400">

          Adaptive operational environments across the platform.

        </p>

      </div>

      <div className="grid gap-5 lg:grid-cols-2">

        {workspaces.map((workspace) => (

          <Link
            key={workspace.id}
            href={workspace.route}
            className="rounded-2xl border border-zinc-800 bg-black p-6 transition hover:border-zinc-700 hover:bg-zinc-950"
          >

            <h3 className="text-xl font-bold text-white">

              {workspace.title}

            </h3>

            <p className="mt-3 text-zinc-400 leading-7">

              {workspace.description}

            </p>

            <div className="mt-6 flex flex-wrap gap-2">

              {workspace.roles.map((role) => (

                <span
                  key={role}
                  className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400"
                >

                  {role}

                </span>

              ))}

            </div>

          </Link>

        ))}

      </div>

    </div>

  );
}