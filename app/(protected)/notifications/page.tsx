"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/layout/PageHeader";
import SlideOverPanel from "@/app/components/overlays/SlideOverPanel";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  useEffect(() => {
    async function fetchNotifications() {
      const { data: leases } = await supabase.from("leases").select("*");
      const { data: tasks } = await supabase.from("tasks").select("*");
      const generatedNotifications: any[] = [];

      leases?.forEach((lease) => {
        if (!lease.expiry_date) return;
        const expiry = new Date(lease.expiry_date);
        const today = new Date();
        const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          generatedNotifications.push({
            type: "critical",
            title: "Lease Expiry Risk",
            message: `${lease.tenant_name} lease expires within 30 days.`,
            detail: "Immediate renewal engagement recommended to mitigate operational vacancy exposure.",
          });
        } else if (diffDays <= 90) {
          generatedNotifications.push({
            type: "warning",
            title: "Renewal Engagement",
            message: `${lease.tenant_name} renewal engagement required.`,
            detail: "Tenant retention strategy should be initiated proactively.",
          });
        }

        if (lease.vacancy_risk === "Critical") {
          generatedNotifications.push({
            type: "risk",
            title: "Vacancy Exposure",
            message: `${lease.tenant_name} marked as critical vacancy exposure.`,
            detail: "Asset performance deterioration detected. Escalated monitoring recommended.",
          });
        }
      });

      tasks?.forEach((task) => {
        if (task.task_status !== "Completed") {
          generatedNotifications.push({
            type: "task",
            title: "Outstanding Task",
            message: `Outstanding operational task: ${task.task_type || task.task_id || "Task"}`,
            detail: "Operational workflow remains incomplete and requires action.",
          });
        }
      });

      setNotifications(generatedNotifications);
    }
    fetchNotifications();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader
        title="Notifications Center"
        subtitle="Real-time operational alerts and executive intelligence."
      />

      <div className="rounded-3xl border border-zinc-800 bg-[var(--bg-secondary)] p-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-bold text-white">Active Notifications</h2>
            <p className="text-zinc-500 mt-2">Operational events requiring review or action.</p>
          </div>
          <div className="rounded-full bg-white px-5 py-3 text-sm font-bold text-black">
            {notifications.length} Active
          </div>
        </div>

        <div className="space-y-4">
          {notifications.length === 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-[var(--bg-primary)] p-10 text-center">
              <p className="text-zinc-500">No active operational notifications.</p>
            </div>
          )}

          {notifications.map((notification, index) => (
            <button
              key={index}
              onClick={() => setSelectedNotification(notification)}
              className={`w-full rounded-2xl border p-6 text-left transition-all hover:scale-[1.01] ${
                notification.type === "critical"
                  ? "border-red-500/20 bg-red-500/5"
                  : notification.type === "warning"
                  ? "border-orange-500/20 bg-orange-500/5"
                  : notification.type === "risk"
                  ? "border-yellow-500/20 bg-yellow-500/5"
                  : "border-blue-500/20 bg-blue-500/5"
              }`}
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] mb-3 text-zinc-500">
                    {notification.title}
                  </p>
                  <p className="text-lg font-semibold text-white">{notification.message}</p>
                </div>
                <div className="text-sm font-medium text-zinc-500">View</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <SlideOverPanel
        open={!!selectedNotification}
        onClose={() => setSelectedNotification(null)}
        title={selectedNotification?.title || "Notification"}
      >
        {selectedNotification && (
          <div className="space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500 mb-3">Notification</p>
              <p className="text-2xl font-bold text-white">{selectedNotification.message}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-[var(--bg-primary)] p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500 mb-3">Operational Insight</p>
              <p className="text-zinc-400 leading-7">{selectedNotification.detail}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black">Open Workspace</button>
              <button className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300">Mark Reviewed</button>
              <button className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-3 text-sm font-semibold text-red-300">Escalate Issue</button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
}
