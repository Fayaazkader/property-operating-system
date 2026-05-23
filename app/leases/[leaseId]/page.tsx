"use client";
import {
  useEffect,
  useState,
} from "react";

import { useParams } from "next/navigation";

import { supabase } from "../../../lib/supabase";

import PageShell from "../../components/layout/PageShell";
import KpiCard from "../../components/dashboard/KpiCard";
import StatusBadge from "../../components/ui/StatusBadge";
import DocumentUploader from "../../components/documents/DocumentUploader";

export default function LeaseDetailPage() {
const resolvedParams =
  useParams();

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
        console.log("FETCH STARTED");

const { data: leaseData } =
  await supabase
    .from("leases")
    .select("*")
    .limit(1)
    .single();

setLease(leaseData);

console.log("LEASE DATA:", leaseData);
console.log(
  "LEASE ID FIELD:",
  leaseData?.lease_id
);

console.log(
  "DATABASE ID FIELD:",
  leaseData?.id
);


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

    <PageShell>

      <div className="p-10">

        <div className="rounded-3xl bg-zinc-900 p-10 text-white">

          <h1 className="text-4xl font-black">

            Loading Lease...

          </h1>

        </div>

      </div>

    </PageShell>

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

    <div className="p-10">

      <div className="rounded-3xl bg-black p-10 text-white">

        <h1 className="text-5xl font-black">

          Lease Workspace

        </h1>

        <p className="mt-4 text-zinc-400">

          Lease loaded successfully.

        </p>

        <p className="mt-6 text-sm text-zinc-500">

          Lease ID:
          {" "}
          {String(resolvedParams.leaseId)}

        </p>

      </div>

    </div>

  </PageShell>

);
}