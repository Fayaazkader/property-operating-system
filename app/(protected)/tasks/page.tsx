"use client";

import { usePlatform } from "../../context/PlatformContext";

export default function TasksPage() {

  const {
    activeCompany,
    activeRole,
  } = usePlatform();

  const tasks = [
    

    {
      id: 1,
      title:
        "Lease renewal negotiation",
      priority: "High",
      status: "In Progress",
      dueDate: "2026-06-02",
      workspace: "Leasing",
      owner: "Sarah Chen",
    },

    {
      id: 2,
      title:
        "Arrears escalation review",
      priority: "Critical",
      status: "Pending",
      dueDate: "2026-05-28",
      workspace: "Finance",
      owner: "Michael Jacobs"
    },

    {
      id: 3,
      title:
        "Portfolio occupancy audit",
      priority: "Medium",
      status: "Scheduled",
      dueDate: "2026-06-10",
      workspace: "Executive",
      owner: "Executive Office"
    },

    {
      id: 4,
      title:
        "Maintenance contractor approval",
      priority: "High",
      status: "Awaiting Approval",
      dueDate: "2026-05-30",
      workspace: "Operations",
      owner: "David Naidoo"
    },
    

  ];
  const statusStyles = {
    

  Pending:
    "bg-zinc-800 text-zinc-300",

  "In Progress":
    "bg-blue-500/20 text-blue-400",

  "Awaiting Approval":
    "bg-orange-500/20 text-orange-400",

  Resolved:
    "bg-green-500/20 text-green-400",

  Escalated:
    "bg-red-500/20 text-red-400",

};
const priorityStyles = {

  Critical:
    "border-red-500/30 bg-red-500/10 text-red-400",

  High:
    "border-orange-500/30 bg-orange-500/10 text-orange-400",

  Medium:
    "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",

  Low:
    "border-zinc-700 bg-zinc-800 text-zinc-300",

};
const groupedTasks = tasks.reduce(

  (groups, task) => {

    if (!groups[task.status]) {

      groups[task.status] = [];
    }

    groups[task.status].push(task);

    return groups;

  },

  {} as Record<string, typeof tasks>

);

  return (

    <div className="p-8">

      <div className="mb-8">

        <p className="text-sm uppercase tracking-[0.25em] text-zinc-500 mb-3">

          Operational Workflow System

        </p>

        <h1 className="text-5xl font-black text-white">

          Tasks Workspace

        </h1>

        <p className="mt-4 text-zinc-400 max-w-3xl leading-8">

          Centralized operational workflow orchestration across leasing,
          finance, executive management, and operations.

        </p>

      </div>

      <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">

        <div className="flex flex-wrap items-center gap-6">

          <div>

            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">

              Active Organization

            </p>

            <p className="text-lg font-semibold text-white">

              {activeCompany.name}

            </p>

          </div>

          <div>

            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">

              Active Role

            </p>

            <p className="text-lg font-semibold text-white">

              {activeRole.label}

            </p>

          </div>

        </div>

      </div>

    <div className="space-y-10">

  {Object.entries(groupedTasks).map(

    ([status, tasks]) => (

      <div key={status}>

        <div className="mb-5 flex items-center justify-between">

          <h2 className="text-2xl font-bold text-white">

            {status}

          </h2>

          <span className="rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-400">

            {tasks.length}
            {" "}
            Tasks

          </span>

        </div>

        <div className="grid gap-5">

          {tasks.map((task) => (

            <div
              key={task.id}
              className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6"
            >

              <div className="flex flex-wrap items-start justify-between gap-4">

                <div>

                  <p className="text-2xl font-bold text-white">

                    {task.title}

                  </p>

                  <p className="mt-3 text-zinc-400">

                    Workspace:
                    {" "}
                    {task.workspace}

                  </p>
                  <p className="mt-2 text-zinc-500">

  Owner:
  {" "}
  <span className="text-white font-medium">

    {task.owner}

  </span>

</p>

                </div>

                <div className="flex flex-wrap gap-3">

                  <span
                    className={`
                      rounded-full
                      border
                      px-4
                      py-2
                      text-sm
                      font-semibold

                      ${
                        priorityStyles[
                          task.priority as keyof typeof priorityStyles
                        ]
                      }
                    `}
                  >

                    {task.priority}

                  </span>

                  <span
                    className={`
                      rounded-full
                      px-4
                      py-2
                      text-sm
                      font-semibold

                      ${
                        statusStyles[
                          task.status as keyof typeof statusStyles
                        ]
                      }
                    `}
                  >

                    {task.status}

                  </span>

                </div>

              </div>

              <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-5">

                <p className="text-sm text-zinc-500">

                  Due:
                  {" "}
                  {task.dueDate}

                </p>

                <button className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200">

                  Open Workflow

                </button>

              </div>

            </div>

          ))}

        </div>

      </div>

    )

  )}

</div>

    </div>

  );
}