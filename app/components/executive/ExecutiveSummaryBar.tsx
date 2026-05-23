type Props = {
  leaseCount: number;
  occupancyRate: number;
  renewalCount: number;
  portfolioRiskLevel: string;
};

export default function ExecutiveSummaryBar({
  leaseCount,
  occupancyRate,
  renewalCount,
  portfolioRiskLevel,
}: Props) {

  return (

    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">

      <div className="rounded-2xl bg-black p-5 text-white">

        <p className="text-sm uppercase tracking-[0.15em] text-zinc-400 mb-2">
          Total Leases
        </p>

        <p className="text-3xl font-black">
          {leaseCount}
        </p>

      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">

        <p className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-2">
          Portfolios
        </p>

        <p className="text-3xl font-black text-black">
          3
        </p>

      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">

        <p className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-2">
          Occupancy
        </p>

        <p className="text-3xl font-black text-green-600">
          {occupancyRate}%
        </p>

      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">

        <p className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-2">
          Renewals
        </p>

        <p className="text-3xl font-black text-orange-500">
          {renewalCount}
        </p>

      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">

        <p className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-2">
          Portfolio Status
        </p>

        <p className="text-xl font-black text-black">
          {portfolioRiskLevel}
        </p>

      </div>

    </div>

  );
}