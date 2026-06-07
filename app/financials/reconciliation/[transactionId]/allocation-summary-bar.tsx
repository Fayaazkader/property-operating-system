import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  transactionTotal: number;
  allocatedTotal: number;
  isBalanced: boolean;
  lineCount: number;
}

export function AllocationSummaryBar({
  transactionTotal,
  allocatedTotal,
  isBalanced,
  lineCount,
}: Props) {
  const remaining = transactionTotal - allocatedTotal;

  return (
    <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950 px-8 py-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <span className="text-zinc-400">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Allocated:</span>
            <span className="text-white font-medium tabular-nums">
              R{allocatedTotal.toLocaleString()}
            </span>
          </div>
          {!isBalanced && lineCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-amber-400">Remaining:</span>
              <span className="text-amber-400 font-medium tabular-nums">
                R{remaining.toLocaleString()}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!isBalanced && lineCount > 0 && (
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">Unbalanced — allocate remaining R{remaining.toLocaleString()}</span>
            </div>
          )}
          {isBalanced && lineCount > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs">Balanced</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}