"use client";

import React, {
  useEffect,
  useState,
} from "react";

import { supabase } from "../../../lib/supabase";

export default function LeaseDetailPage({
  params,
}: {
  params: Promise<{ leaseId: string }>;
}) {

  const resolvedParams =
    React.use(params);

  const [lease, setLease] =
    useState<any>(null);

  const [tasks, setTasks] =
    useState<any[]>([]);

  const [activities, setActivities] =
    useState<any[]>([]);

  const [taskTitle, setTaskTitle] =
    useState("");

  const [
    taskDescription,
    setTaskDescription,
  ] = useState("");

  const [priority, setPriority] =
    useState("Medium");

  const [activityNote, setActivityNote] =
    useState("");

  useEffect(() => {

    async function fetchData() {

      const { data: leaseData } =
        await supabase
          .from("leases")
          .select("*")
          .eq(
            "lease_id",
            resolvedParams.leaseId
          )
          .single();

      setLease(leaseData);

      const { data: taskData } =
        await supabase
          .from("tasks")
          .select("*")
          .eq(
            "lease_id",
            resolvedParams.leaseId
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

      setTasks(taskData || []);

      const {
        data: activityData,
      } = await supabase
        .from("activities")
        .select("*")
        .eq(
          "lease_id",
          resolvedParams.leaseId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      setActivities(
        activityData || []
      );
    }

    fetchData();

  }, [resolvedParams.leaseId]);

  async function handleCreateTask() {

    if (!taskTitle) {

      alert("Enter task title");

      return;
    }

    const { error } =
      await supabase
        .from("tasks")
        .insert([{

          lease_id:
            resolvedParams.leaseId,

          task_title: taskTitle,

          task_description:
            taskDescription,

          priority: priority,

        }]);

    if (error) {

      alert(error.message);

    } else {

      window.location.reload();
    }
  }

  async function completeTask(
    id: string
  ) {

    await supabase
      .from("tasks")
      .update({
        status: "Completed",
      })
      .eq("id", id);

    window.location.reload();
  }

  async function addActivity() {

    if (!activityNote) {

      alert("Enter activity note");

      return;
    }

    const { error } =
      await supabase
        .from("activities")
        .insert([{

          lease_id:
            resolvedParams.leaseId,

          activity_type:
            "Operational Note",

          activity_note:
            activityNote,

          created_by:
            "Asset Manager",

        }]);

    if (error) {

      alert(error.message);

    } else {

      window.location.reload();
    }
  }

  if (!lease) {

    return (
      <main className="p-10">
        Loading...
      </main>
    );
  }

  return (

    <main className="min-h-screen bg-gray-100 p-10 text-black">

      <div className="flex justify-between items-center mb-8">

        <h1 className="text-4xl font-bold">
          Lease Workspace
        </h1>

        <a
          href={`/leases/${lease.lease_id}/edit`}
          className="bg-black text-white px-5 py-3 rounded-lg"
        >
          Edit Lease
        </a>

      </div>

      <div className="bg-white rounded-xl shadow p-8 mb-10">

        <div className="grid grid-cols-3 gap-8">

          <div>

            <p className="text-gray-500 text-sm">
              Lease ID
            </p>

            <p className="font-bold text-lg">
              {lease.lease_id}
            </p>

          </div>

          <div>

            <p className="text-gray-500 text-sm">
              Tenant Name
            </p>

            <p className="font-bold text-lg">
              {lease.tenant_name}
            </p>

          </div>

          <div>

            <p className="text-gray-500 text-sm">
              Property Name
            </p>

            <p className="font-bold text-lg">
              {lease.property_name}
            </p>

          </div>

          <div>

            <p className="text-gray-500 text-sm">
              Expiry Date
            </p>

            <p className="font-bold text-lg">
              {lease.expiry_date}
            </p>

          </div>

          <div>

            <p className="text-gray-500 text-sm">
              Monthly Rental
            </p>

            <p className="font-bold text-lg">
              R {lease.monthly_rental}
            </p>

          </div>

        </div>

      </div>

      <div className="grid grid-cols-2 gap-6 mb-10">

        <div className="bg-white rounded-xl shadow p-8">

          <h2 className="text-2xl font-bold mb-6">
            Create Task
          </h2>

          <input
            type="text"
            placeholder="Task title"
            value={taskTitle}
            onChange={(e) =>
              setTaskTitle(
                e.target.value
              )
            }
            className="border rounded-lg p-3 w-full mb-4"
          />

          <select
            value={priority}
            onChange={(e) =>
              setPriority(
                e.target.value
              )
            }
            className="border rounded-lg p-3 w-full mb-4"
          >

            <option>
              Low
            </option>

            <option>
              Medium
            </option>

            <option>
              High
            </option>

            <option>
              Critical
            </option>

          </select>

          <textarea
            placeholder="Task description"
            value={taskDescription}
            onChange={(e) =>
              setTaskDescription(
                e.target.value
              )
            }
            className="border rounded-lg p-3 w-full"
            rows={4}
          />

          <button
            onClick={handleCreateTask}
            className="mt-6 bg-black text-white px-6 py-3 rounded-lg"
          >
            Create Task
          </button>

        </div>

        <div className="bg-white rounded-xl shadow p-8">

          <h2 className="text-2xl font-bold mb-6">
            Add Activity
          </h2>

          <textarea
            placeholder="Add operational note, meeting summary or communication update..."
            value={activityNote}
            onChange={(e) =>
              setActivityNote(
                e.target.value
              )
            }
            className="border rounded-lg p-3 w-full"
            rows={8}
          />

          <button
            onClick={addActivity}
            className="mt-6 bg-black text-white px-6 py-3 rounded-lg"
          >
            Save Activity
          </button>

        </div>

      </div>

      <div className="bg-white rounded-xl shadow p-8 mb-10">

        <h2 className="text-2xl font-bold mb-6">
          Operational Tasks
        </h2>

        <div className="space-y-4">

          {tasks.length === 0 && (

            <p className="text-gray-500">
              No tasks yet.
            </p>

          )}

          {tasks.map((task) => (

            <div
              key={task.id}
              className="border rounded-xl p-6 flex justify-between items-start"
            >

              <div>

                <div className="flex items-center gap-3 mb-2">

                  <h3 className="font-bold text-lg">
                    {task.task_title}
                  </h3>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold
                    ${
                      task.priority === "Critical"
                        ? "bg-red-100 text-red-700"
                        : task.priority === "High"
                        ? "bg-orange-100 text-orange-700"
                        : task.priority === "Medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {task.priority}
                  </span>

                </div>

                <p className="text-gray-600">
                  {task.task_description}
                </p>

                <p className="text-sm text-gray-400 mt-3">
                  Status: {task.status}
                </p>

              </div>

              {task.status !==
                "Completed" && (

                <button
                  onClick={() =>
                    completeTask(
                      task.id
                    )
                  }
                  className="bg-black text-white px-4 py-2 rounded-lg"
                >
                  Complete
                </button>

              )}

            </div>

          ))}

        </div>

      </div>

      <div className="bg-white rounded-xl shadow p-8">

        <h2 className="text-2xl font-bold mb-6">
          Activity Timeline
        </h2>

        <div className="space-y-4">

          {activities.length === 0 && (

            <p className="text-gray-500">
              No activity yet.
            </p>

          )}

          {activities.map(
            (activity) => (

              <div
                key={activity.id}
                className="border-l-4 border-black bg-gray-50 p-5 rounded-lg"
              >

                <div className="flex justify-between items-center mb-3">

                  <span className="font-bold">
                    {
                      activity.activity_type
                    }
                  </span>

                  <span className="text-sm text-gray-500">
                    {new Date(
                      activity.created_at
                    ).toLocaleString()}
                  </span>

                </div>

                <p className="text-gray-700">
                  {
                    activity.activity_note
                  }
                </p>

                <p className="text-sm text-gray-400 mt-3">
                  By: {
                    activity.created_by
                  }
                </p>

              </div>

            )
          )}

        </div>

      </div>

    </main>
  );
}