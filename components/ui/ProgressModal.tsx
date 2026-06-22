"use client";

import { useState, useEffect } from "react";

type ProgressStep = {
  label: string;
  status: "waiting" | "running" | "done" | "failed";
  count?: number;
  total?: number;
};

type ProgressModalProps = {
  title: string;
  steps: ProgressStep[];
  onClose?: () => void;
};

export default function ProgressModal({ title, steps, onClose }: ProgressModalProps) {
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    const finished = steps.every(s => s.status === "done" || s.status === "failed");
    setAllDone(finished);
  }, [steps]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-lg mx-4 shadow-2xl p-8">
        <p className="text-lg font-semibold text-[var(--text-primary)] mb-6">{title}</p>
        
        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="shrink-0">
                {step.status === "waiting" && (
                  <div className="w-5 h-5 rounded-full border-2 border-[var(--border-default)]" />
                )}
                {step.status === "running" && (
                  <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                )}
                {step.status === "done" && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
                {step.status === "failed" && (
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white text-xs">✕</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)]">{step.label}</p>
                {step.count !== undefined && step.total !== undefined && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {step.count} / {step.total}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {allDone && onClose && (
          <button
            onClick={onClose}
            className="mt-6 w-full rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-zinc-200 transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
