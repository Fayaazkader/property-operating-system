import {
  calculateOccupancyMetrics,
} from "@/lib/analytics/occupancy";
import {
  BaseWidgetProps,
} from "@/app/types/widgets";

type OccupancyWidgetProps =
  BaseWidgetProps & {
  totalGLA: number;
  occupiedGLA: number;
};

export default function OccupancyWidget({
  totalGLA,
  occupiedGLA,
}: OccupancyWidgetProps) {
  const metrics =
    calculateOccupancyMetrics({
      totalGLA,
      occupiedGLA,
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
        Occupancy Rate
      </p>

      <h2
        className="
          mt-4
          text-5xl
          font-black
          text-white
        "
      >
        {metrics.occupancyRate}%
      </h2>

      <div className="mt-6 space-y-2">

        <p className="text-sm text-zinc-400">
          Occupied GLA:
          {" "}
          {metrics.occupiedGLA}
        </p>

        <p className="text-sm text-zinc-400">
          Vacant GLA:
          {" "}
          {metrics.vacantGLA}
        </p>

      </div>
    </div>
  );
}