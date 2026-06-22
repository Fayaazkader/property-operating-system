import PropertyWorkspaceTabs from "@/app/components/property/PropertyWorkspaceTabs";
type Props = {
  params: Promise<{
    propertyId: string;
  }>;
};

export default async function PropertyPage({
  params,
}: Props) {

  const { propertyId } = await params;

  return (

    <div className="min-h-screen bg-zinc-100 p-8">

      <div className="mx-auto max-w-7xl space-y-6">

        <div className="rounded-3xl bg-black p-8 text-white">

          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400 mb-3">
            Property Workspace
          </p>

          <h1 className="text-4xl font-black capitalize">

            {propertyId.replaceAll("-", " ")}

          </h1>

          <p className="text-zinc-400 mt-4 text-lg">

            Operational property management workspace and intelligence center.

          </p>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="rounded-2xl bg-white border border-zinc-200 p-6">

            <p className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-2">
              Occupancy
            </p>

            <p className="text-3xl font-black text-green-600">
              92%
            </p>

          </div>

          <div className="rounded-2xl bg-white border border-zinc-200 p-6">

            <p className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-2">
              Active Leases
            </p>

            <p className="text-3xl font-black text-black">
              18
            </p>

          </div>

          <div className="rounded-2xl bg-white border border-zinc-200 p-6">

            <p className="text-sm uppercase tracking-[0.15em] text-zinc-500 mb-2">
              Operational Risk
            </p>

            <p className="text-3xl font-black text-orange-500">
              Moderate
            </p>

          </div>

        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

  <div className="xl:col-span-2 space-y-6">

    <div className="rounded-2xl bg-white border border-zinc-200 p-6">

      <div className="flex items-center justify-between mb-6">

        <div>

          <h2 className="text-2xl font-bold text-black">
            Lease Overview
          </h2>

          <p className="text-zinc-500 mt-1">
            Active lease operational visibility.
          </p>

        </div>

        <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">

          View All Leases

        </button>

      </div>

      <div className="space-y-4">

        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4">

          <div>

            <p className="font-bold text-black">
              Corporate HQ Lease
            </p>

            <p className="text-sm text-zinc-500 mt-1">
              Expiry: Dec 2027
            </p>

          </div>

          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">

            Stable

          </span>

        </div>

        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4">

          <div>

            <p className="font-bold text-black">
              Logistics Operations
            </p>

            <p className="text-sm text-zinc-500 mt-1">
              Expiry: Mar 2026
            </p>

          </div>

          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">

            Renewal Risk

          </span>

        </div>

      </div>

    </div>

    <div className="rounded-2xl bg-white border border-zinc-200 p-6">

      <div className="flex items-center justify-between mb-6">

        <div>

          <h2 className="text-2xl font-bold text-black">
            Tenant Activity
          </h2>

          <p className="text-zinc-500 mt-1">
            Recent tenant operational interactions.
          </p>

        </div>

      </div>

      <div className="space-y-4">

        <div className="rounded-2xl border border-zinc-200 p-4">

          <p className="font-semibold text-black">
            Lease renewal discussion initiated.
          </p>

          <p className="text-sm text-zinc-500 mt-2">
            2 hours ago
          </p>

        </div>

        <div className="rounded-2xl border border-zinc-200 p-4">

          <p className="font-semibold text-black">
            Updated tenant insurance documentation uploaded.
          </p>

          <p className="text-sm text-zinc-500 mt-2">
            Yesterday
          </p>

        </div>

      </div>

    </div>

  </div>

  <div className="space-y-6">

    <div className="rounded-2xl bg-white border border-zinc-200 p-6">

      <h2 className="text-2xl font-bold text-black mb-6">
        Document Center
      </h2>

      <div className="space-y-3">

        <div className="rounded-xl bg-zinc-100 p-4">

          <p className="font-semibold text-black">
            Master Lease Agreement.pdf
          </p>

        </div>

        <div className="rounded-xl bg-zinc-100 p-4">

          <p className="font-semibold text-black">
            Insurance Schedule.pdf
          </p>

        </div>

        <div className="rounded-xl bg-zinc-100 p-4">

          <p className="font-semibold text-black">
            Operational Compliance.pdf
          </p>

        </div>

      </div>

    </div>

    <div className="rounded-2xl bg-white border border-zinc-200 p-6">

      <h2 className="text-2xl font-bold text-black mb-6">
        Operational Tasks
      </h2>

      <div className="space-y-4">

        <div className="flex items-center justify-between">

          <p className="font-medium text-black">
            Lease escalation review
          </p>

          <span className="text-xs font-bold text-orange-600">
            Pending
          </span>

        </div>

        <div className="flex items-center justify-between">

          <p className="font-medium text-black">
            Tenant compliance audit
          </p>

          <span className="text-xs font-bold text-green-600">
            Complete
          </span>

        </div>

        <div className="flex items-center justify-between">

          <p className="font-medium text-black">
            Parking allocation review
          </p>

          <span className="text-xs font-bold text-blue-600">
            In Progress
          </span>

        </div>

      </div>

    </div>

  </div>

</div>
<PropertyWorkspaceTabs />

      </div>

    </div>

  );
}