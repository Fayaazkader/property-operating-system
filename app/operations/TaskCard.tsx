"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  ESCALATION_LIMIT,
} from "@/lib/workflow";

interface TaskCardProps {
  task: {
    task_id: string;
    task_type: string;
    property_name: string;
    priority: string;
    escalation_level: number;
    task_status: string;
    assigned_to: string;
    due_date: string;
  };
}

export default function TaskCard({
  task,
}: TaskCardProps) {
    const router = useRouter();
   const isOverdue =
  task.due_date &&
  new Date(task.due_date).getTime() <
    Date.now() &&
  task.task_status !==
TASK_STATUSES.COMPLETED;

  async function markComplete() {
    if (task.priority ===
TASK_PRIORITIES.CRITICAL) {

  const confirmed = window.confirm(
    "Are you sure you want to complete this critical operational workflow?"
  );

  if (!confirmed) return;
}
await supabase

  .from("task_audit_log")

  .insert({
    task_id: task.task_id,
    action_type: "Task Completed",
    previous_value: task.task_status,
    new_value: "Completed",
    action_by: "Operations User",
  });
  
    await supabase

      .from("tasks")

      .update({
        task_status: "Completed",
      })

      .eq("task_id", task.task_id);

    router.refresh();
  }

  async function escalateTask() {
    await supabase

  .from("task_audit_log")

  .insert({
    task_id: task.task_id,
    action_type: "Task Escalated",
    previous_value:
      String(task.escalation_level),

    new_value:
      String(task.escalation_level + 1),
      action_by: "Operations User",
      
  });

    await supabase

      .from("tasks")

      .update({
        escalation_level:
          task.escalation_level >=
ESCALATION_LIMIT,
      })

      .eq("task_id", task.task_id);

    router.refresh();
  }
  async function startTask() {

  await supabase

    .from("task_audit_log")

    .insert({
      task_id: task.task_id,
      action_type: "Task Started",
      previous_value: task.task_status,
      new_value: "In Progress",
      action_by: "Operations User",
    });

  await supabase

    .from("tasks")

    .update({
      task_status: "In Progress",
    })

    .eq("task_id", task.task_id);

  router.refresh();
}

  return (

    <div
  className={`
    rounded-3xl
    border
    p-5
    transition

    ${
      task.priority === "Critical"
        ? "border-red-500/40 bg-red-950/10 shadow-[0_0_30px_rgba(239,68,68,0.08)]"
        : "border-zinc-800 bg-black"
    }
  `}
>

      <div className="flex items-start justify-between">

        <div>

          <h3 className="text-2xl font-bold text-white mb-2">

            {task.task_type}

          </h3>

          <p className="text-zinc-400">

            {task.property_name}

          </p>
          <div className="mt-3 inline-flex items-center rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2">

  <div className="mr-3 h-2 w-2 rounded-full bg-emerald-400" />

  <div>

    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">

      Assigned To

    </p>

    <p className="text-sm font-semibold text-white">

      {task.assigned_to || "Unassigned"}

    </p>

  </div>

</div>
          <div className="mt-3">

  <span
    className={`
      rounded-full
      px-3
      py-1
      text-xs
      font-bold
      uppercase
      tracking-[0.2em]
      ${
  isOverdue
    ? "bg-red-500/20 text-red-300"
    : task.task_status === "Completed"
    ? "bg-green-500/20 text-green-300"
    : task.task_status === "In Progress"
    ? "bg-orange-500/20 text-orange-300"
    : task.task_status === "Escalated"
    ? "bg-red-500/20 text-red-300"
    : "bg-blue-500/20 text-blue-300"
}
    `}
  >

    {task.task_status}
    

  </span>
  <p className="mt-3 text-sm text-zinc-500">

  Assigned To:
  {" "}
  <span className="text-zinc-300">

    {task.assigned_to || "Unassigned"}

  </span>

</p>

</div>

        </div>

        <div
          className={`
            rounded-full
            px-4
            py-2
            text-xs
            font-bold
            uppercase
            tracking-[0.25em]
            ${
              task.priority === "Critical"
                ? "bg-red-500/20 text-red-300"
                : task.priority === "High"
                ? "bg-orange-500/20 text-orange-300"
                : "bg-yellow-500/20 text-yellow-300"
            }
          `}
        >

          {task.priority}
          

        </div>
        {isOverdue && (

  <div
    className="
      mt-3
      rounded-full
      border
      border-red-500/20
      bg-red-500/10
      px-4
      py-2
      text-xs
      font-bold
      uppercase
      tracking-[0.25em]
      text-red-300
    "
  >

    Overdue

  </div>

)}

      </div>
      

  <div className="mt-4 flex gap-2">

  {task.task_status === "Open" && (

    <button
      onClick={startTask}
      className="
        rounded-xl
        border
        border-blue-500/20
        bg-blue-500/10
        px-4
        py-2
        text-xs
        font-bold
        uppercase
        tracking-[0.2em]
        text-blue-300
        transition
        hover:bg-blue-500/20
      "
    >

      Start Work

    </button>

  )}

  {task.task_status === "In Progress" && (

    <button
      onClick={markComplete}
      className="
        rounded-xl
        border
        border-green-500/20
        bg-green-500/10
        px-4
        py-2
        text-xs
        font-bold
        uppercase
        tracking-[0.2em]
        text-green-300
        transition
        hover:bg-green-500/20
      "
    >

      Complete

    </button>

  )}

  <button
    onClick={escalateTask}
    className="
      rounded-xl
      border
      border-red-500/20
      bg-red-500/10
      px-4
      py-2
      text-xs
      font-bold
      uppercase
      tracking-[0.2em]
      text-red-300
      transition
      hover:bg-red-500/20
    "
  >

    Escalate

  </button>

</div>
    </div>
  );
}