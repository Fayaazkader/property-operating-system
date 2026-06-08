import { Pencil, Trash2 } from "lucide-react";
import { AllocationLineEdit } from "./allocation-line-edit";
import type { SplitAllocation } from "@/app/types/allocation";

type LookupData = {
  properties: { id: string; property_name: string; property_code?: string }[];
  leases: { id: string; lease_id: string; property_id: string; tenant_id: string; tenant_name?: string }[];
  tenants: { id: string; tenant_name: string; tenant_code?: string }[];
};

interface Props {
  line: SplitAllocation;
  index: number;
  isEditing: boolean;
  lookupData: LookupData;
  currency?: string;
  remaining?: number;
  onEdit: () => void;
  onCancel: () => void;
  onUpdate: (line: SplitAllocation) => void;
  onRemove: () => void;
}

export function AllocationLineCard({
  line,
  index,
  isEditing,
  lookupData,
  currency = "ZAR",
  remaining,
  onEdit,
  onCancel,
  onUpdate,
  onRemove,
}: Props) {
  const property = lookupData.properties.find((p) => p.id === line.propertyId);
  const lease = lookupData.leases.find((l) => l.id === line.leaseId);
  const tenant = lookupData.tenants.find((t) => t.id === line.tenantId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(value);
  };

  // VAT calculations
  const vatAmount = line.vatAmount || 0;
  const inclusiveAmount = line.amount || 0;
  const exclusiveAmount = line.vatTreatment === "vat-inclusive"
    ? inclusiveAmount - vatAmount
    : line.vatTreatment === "vat-exclusive"
    ? inclusiveAmount
    : inclusiveAmount;

  if (isEditing) {
    return (
      <AllocationLineEdit
        line={line}
        index={index}
        lookupData={lookupData}
        currency={currency}
        remaining={remaining}
        onSave={(updatedLine) => {
          onUpdate(updatedLine);
          onCancel();
        }}
        onCancel={onCancel}
      />
    );
  }

  return (
    <div className="group rounded-3xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors">
      <div className="flex items-center px-5 py-4 gap-4">
        <span className="text-xs text-zinc-500 font-mono w-6">#{index + 1}</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-300 truncate">
            {property?.property_name || lease?.lease_id || tenant?.tenant_name || (
              <span className="text-zinc-600">Unallocated</span>
            )}
          </p>
          {line.glAccountCode && (
            <p className="text-xs text-zinc-500 font-mono mt-0.5">{line.glAccountCode}</p>
          )}
        </div>

        <div className="w-28 text-right">
          <p className="text-sm text-zinc-300 tabular-nums">
            {formatCurrency(exclusiveAmount)}
          </p>
        </div>

        <div className="w-24 text-right">
          <p className="text-sm text-zinc-400 tabular-nums">
            {vatAmount > 0 ? formatCurrency(vatAmount) : "—"}
          </p>
        </div>

        <div className="w-32 text-right">
          <p className="text-sm text-white font-medium tabular-nums">
            {formatCurrency(inclusiveAmount)}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-xl"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}