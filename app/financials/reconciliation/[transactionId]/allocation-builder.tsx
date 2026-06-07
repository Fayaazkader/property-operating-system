import { Plus } from "lucide-react";
import { AllocationLineCard } from "./allocation-line-card";
import type { SplitAllocation } from "@/app/types/allocation";

type LookupData = {
  properties: { id: string; property_name: string; property_code?: string }[];
  leases: { id: string; lease_id: string; property_id: string; tenant_id: string; tenant_name?: string }[];
  tenants: { id: string; tenant_name: string; tenant_code?: string }[];
};

interface Props {
  allocations: SplitAllocation[];
  editingLineId: string | null;
  lookupData: LookupData;
  transactionTotal: number;
  allocatedTotal: number;
  isBalanced: boolean;
  currency?: string;
  onEditLine: (id: string | null) => void;
  onUpdateLine: (line: SplitAllocation) => void;
  onRemoveLine: (id: string) => void;
  onAddLine: () => void;
}

export function AllocationBuilder({
  allocations,
  editingLineId,
  lookupData,
  transactionTotal,
  allocatedTotal,
  isBalanced,
  onEditLine,
  onUpdateLine,
  onRemoveLine,
  onAddLine,
}: Props) {
  const remaining = transactionTotal - allocatedTotal;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Allocation Builder</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Allocate across properties, leases, tenants, and GL codes
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isBalanced && allocations.length > 0 && (
            <span className="text-sm text-amber-400 tabular-nums">
              Remaining: R{remaining.toLocaleString()}
            </span>
          )}
          {isBalanced && allocations.length > 0 && (
            <span className="text-sm text-emerald-400">Balanced</span>
          )}
        </div>
      </div>

      {allocations.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-500 mb-5">
            No allocation lines yet. Start building your allocation.
          </p>
          <button
            onClick={onAddLine}
            className="rounded-2xl bg-zinc-900 border border-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-600 transition-colors"
          >
            Add First Allocation Line
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {allocations.map((line, index) => (
            <AllocationLineCard
              key={line.id}
              line={line}
              index={index}
              isEditing={editingLineId === line.id}
              lookupData={lookupData}
              onEdit={() => onEditLine(line.id)}
              onCancel={() => onEditLine(null)}
              onUpdate={onUpdateLine}
              onRemove={() => onRemoveLine(line.id)}
            />
          ))}
        </div>
      )}

      <button
        onClick={onAddLine}
        className="w-full py-5 border-2 border-dashed border-zinc-800 rounded-3xl
          text-zinc-500 hover:text-zinc-300 hover:border-zinc-700
          transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm font-medium">Add Allocation Line</span>
      </button>
    </div>
  );
}