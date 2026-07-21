'use client';

import { useEffect, useState } from "react";
import { financialTimelineEngine } from "@/lib/financial/timeline-engine";
import type { FinancialTimelineEntry } from "@/lib/financial/types";

interface PeriodTimelineProps {
  periodName: string;
  entityId?: string;
}

export function PeriodTimeline({ periodName, entityId = "default" }: PeriodTimelineProps) {
  const [events, setEvents] = useState<FinancialTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const data = await financialTimelineEngine.getTimeline(
          entityId,
          "statement_period",
          periodName
        );
        setEvents(data);
      } catch (error) {
        console.error("Error loading timeline:", error);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [periodName, entityId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Timeline</p>
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-[var(--bg-elevated)] rounded" />
          <div className="h-10 bg-[var(--bg-elevated)] rounded" />
          <div className="h-10 bg-[var(--bg-elevated)] rounded" />
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Timeline</p>
        <p className="text-sm text-[var(--text-muted)]">No events recorded for this period</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Timeline</p>
      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] mt-1.5" />
            <div>
              <p className="text-sm text-[var(--text-primary)]">
                {event.description || event.event_type.replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {new Date(event.created_at).toLocaleString("en-ZA", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
