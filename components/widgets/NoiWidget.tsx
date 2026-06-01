import {
  calculateNoiMetrics,
} from "@/lib/analytics/noi";

type NoiWidgetProps = {
  grossRevenue: number;
  operatingExpenses: number;
};

export default function NoiWidget({
  grossRevenue,
  operatingExpenses,
}: NoiWidgetProps) {
  const metrics =
    calculateNoiMetrics({
      grossRevenue,
      operatingExpenses,
    });

  return (
    <div
      className="
        rounded-3xl
        border
        border-zinc-800
        bg-zinc-900
        p-6
      "
    >
      <p
        className="
          text-xs
          uppercase
          tracking-[0.2em]
          text-zinc-500
        "
      >
        Net Operating Income
      </p>

      <h2
        className="
          mt-4
          text-5xl
          font-black
          text-white
        "
      >
        R
        {metrics.netOperatingIncome.toLocaleString()}
      </h2>

      <div className="mt-6 space-y-2">

        <p className="text-sm text-zinc-400">
          Revenue:
          {" "}
          R
          {metrics.grossRevenue.toLocaleString()}
        </p>

        <p className="text-sm text-zinc-400">
          Expense Ratio:
          {" "}
          {metrics.expenseRatio}%
        </p>

      </div>
    </div>
  );
}