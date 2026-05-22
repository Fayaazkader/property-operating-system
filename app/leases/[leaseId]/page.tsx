"use client";

import React, {
  useEffect,
  useState,
} from "react";

import { supabase } from "../../../lib/supabase";

import PageShell from "../../components/layout/PageShell";
import KpiCard from "../../components/dashboard/KpiCard";
import StatusBadge from "../../components/ui/StatusBadge";
import DocumentUploader from "../../components/documents/DocumentUploader";

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

    const [documents, setDocuments] =
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
      const { data: documentData } =
  await supabase
    .from("lease_documents")
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

setDocuments(
  documentData || []
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
      <main className="p-10 text-white">
        Loading...
      </main>
    );
  }

  const expiry =
    new Date(lease.expiry_date);

  const today =
    new Date();

  const expiryDays =
    Math.ceil(
      (expiry.getTime() -
        today.getTime()) /
      (1000 * 60 * 60 * 24)
    );

  const renewalRisk =
    expiryDays <= 30
      ? "Critical"
      : expiryDays <= 90
      ? "Moderate"
      : "Stable";

  return (

    <PageShell>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

        <div>

          <h1 className="text-4xl font-bold text-white">
            Lease Workspace
          </h1>

          <p className="text-zinc-400 mt-2">
            Operational lease management and intelligence environment.
          </p>

        </div>

        <a
          href={`/leases/${lease.lease_id}/edit`}
          className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 font-semibold text-black"
        >
          Edit Lease
        </a>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        <KpiCard
          title="Monthly Rental"
          value={`R ${Number(
            lease.monthly_rental || 0
          ).toLocaleString()}`}
          trend="Current contractual revenue"
        />

        <KpiCard
          title="Days To Expiry"
          value={expiryDays}
          valueColor={
            expiryDays <= 30
              ? "text-red-600"
              : expiryDays <= 90
              ? "text-orange-500"
              : "text-green-600"
          }
          trend="Lease renewal exposure"
        />

        <KpiCard
          title="Operational Tasks"
          value={tasks.length}
          trend="Workflow actions linked to lease"
        />

        <KpiCard
          title="Renewal Risk"
          value={renewalRisk}
          valueColor={
            renewalRisk === "Critical"
              ? "text-red-600"
              : renewalRisk === "Moderate"
              ? "text-orange-500"
              : "text-green-600"
          }
          trend="Operational intelligence assessment"
        />

      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-8">

        <div className="flex items-center justify-between mb-8">

          <h2 className="text-2xl font-bold text-black">
            Lease Information
          </h2>

          <StatusBadge
            status={renewalRisk}
          />

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">

          <div>

            <p className="text-zinc-500 text-sm mb-2">
              Lease ID
            </p>

            <p className="font-bold text-lg text-black">
              {lease.lease_id}
            </p>

          </div>

          <div>

            <p className="text-zinc-500 text-sm mb-2">
              Tenant Name
            </p>

            <p className="font-bold text-lg text-black">
              {lease.tenant_name}
            </p>

          </div>

          <div>

            <p className="text-zinc-500 text-sm mb-2">
              Property Name
            </p>

            <p className="font-bold text-lg text-black">
              {lease.property_name}
            </p>

          </div>

          <div>

            <p className="text-zinc-500 text-sm mb-2">
              Expiry Date
            </p>

            <p className="font-bold text-lg text-black">
              {lease.expiry_date}
            </p>

          </div>

          <div>

            <p className="text-zinc-500 text-sm mb-2">
              Monthly Rental
            </p>

            <p className="font-bold text-lg text-black">
              R {lease.monthly_rental}
            </p>

          </div>

        </div>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-8">

          <h2 className="text-2xl font-bold text-black mb-8">
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
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 mb-4"
          />

          <select
            value={priority}
            onChange={(e) =>
              setPriority(
                e.target.value
              )
            }
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 mb-4"
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
            rows={5}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3"
          />

          <button
            onClick={handleCreateTask}
            className="mt-6 rounded-2xl bg-black px-6 py-3 font-semibold text-white"
          >
            Create Task
          </button>

        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-8">

          <h2 className="text-2xl font-bold text-black mb-8">
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
            rows={10}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3"
          />

          <button
            onClick={addActivity}
            className="mt-6 rounded-2xl bg-black px-6 py-3 font-semibold text-white"
          >
            Save Activity
          </button>

        </div>

      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-8">

        <div className="flex items-center justify-between mb-8">

          <h2 className="text-2xl font-bold text-black">
            Operational Tasks
          </h2>

          <StatusBadge
            status={`${tasks.length} Active`}
          />

        </div>

        <div className="space-y-4">

          {tasks.length === 0 && (

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">

              <p className="text-zinc-500">
                No operational tasks yet.
              </p>

            </div>

          )}

          {tasks.map((task) => (

            <div
              key={task.id}
              className="rounded-2xl border border-zinc-200 p-6"
            >

              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">

                <div>

                  <div className="flex items-center gap-3 mb-3">

                    <h3 className="text-lg font-bold text-black">
                      {task.task_title}
                    </h3>

                    <StatusBadge
                      status={task.priority}
                    />

                  </div>

                  <p className="text-zinc-600">
                    {task.task_description}
                  </p>

                  <div className="mt-4">

                    <StatusBadge
                      status={
                        task.status ||
                        "Active"
                      }
                    />

                  </div>

                </div>

                {task.status !==
                  "Completed" && (

                  <button
                    onClick={() =>
                      completeTask(
                        task.id
                      )
                    }
                    className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                  >
                    Complete
                  </button>

                )}

              </div>

            </div>

          ))}

        </div>

      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-8">

        <h2 className="text-2xl font-bold text-black mb-8">
          Activity Timeline
        </h2>

        <div className="space-y-4">

          {activities.length === 0 && (

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">

              <p className="text-zinc-500">
                No activity yet.
              </p>

            </div>

          )}

          {activities.map(
            (activity) => (

              <div
                key={activity.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
              >

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">

                  <div className="flex items-center gap-3">

                    <StatusBadge
                      status={
                        activity.activity_type
                      }
                    />

                  </div>

                  <p className="text-sm text-zinc-500">

                    {new Date(
                      activity.created_at
                    ).toLocaleString()}

                  </p>

                </div>

                <p className="text-zinc-700 leading-7">

                  {activity.activity_note}

                </p>

                <p className="mt-5 text-sm text-zinc-500">

                  By: {activity.created_by}

                </p>

              </div>

            )
          )}

        </div>

      </div>
<div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-8">

  <div className="flex items-center justify-between mb-8">

    <div>

      <h2 className="text-2xl font-bold text-black">
        Lease Documents
      </h2>

      <p className="text-zinc-500 mt-2">
        Operational lease agreements and supporting documentation.
      </p>

    </div>

    <StatusBadge
      status={`${documents.length} Documents`}
    />

  </div>

  <div className="mb-8">

    <DocumentUploader
      leaseId={lease.lease_id}
      onUploadComplete={() =>
        window.location.reload()
      }
    />

  </div>

  <div className="space-y-4">

    {documents.length === 0 && (

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">

        <p className="text-zinc-500">
          No lease documents uploaded yet.
        </p>

      </div>

    )}

    {documents.map((document) => (

      <div
        key={document.id}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 rounded-2xl border border-zinc-200 p-6"
      >

        <div>

          <div className="flex items-center gap-3 mb-3">

            <p className="text-lg font-bold text-black">

              {document.document_name}

            </p>

            <StatusBadge
              status={
                document.document_type ||
                "Document"
              }
            />

          </div>

          <p className="text-sm text-zinc-500">

            Uploaded by {document.uploaded_by}

          </p>

        </div>

        <a
          href={document.document_url}
          target="_blank"
          className="inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
        >
          Open Document
        </a>

      </div>

    ))}

  </div>

</div>
    </PageShell>
  );
}