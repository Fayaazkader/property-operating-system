import { PageHeader } from "@/app/components/layout/PageHeader";

// Replace header with:
<PageHeader
  title="Banking Imports"
  subtitle="Upload bank statements to populate the Cash Book."
/>
export default function ImportsPage() {

  return (

    <main className="p-10 text-black">

      <div className="mb-10">

        <h1 className="text-4xl font-bold mb-3">
          Import Center
        </h1>

        <p className="text-gray-500 text-lg">
          Import operational property data from Excel, MRI, MDA and external systems.
        </p>

      </div>

      <div className="grid grid-cols-3 gap-6">

        <div className="bg-white rounded-xl shadow p-8">

          <h2 className="text-2xl font-bold mb-4">
            Lease Imports
          </h2>

          <p className="text-gray-500 mb-6">
            Import lease schedules and tenant information.
          </p>

          <button className="bg-black text-white px-5 py-3 rounded-lg">
            Upload Lease File
          </button>

        </div>

        <div className="bg-white rounded-xl shadow p-8">

          <h2 className="text-2xl font-bold mb-4">
            Tenant Imports
          </h2>

          <p className="text-gray-500 mb-6">
            Import CRM and tenant relationship data.
          </p>

          <button className="bg-black text-white px-5 py-3 rounded-lg">
            Upload Tenant File
          </button>

        </div>

        <div className="bg-white rounded-xl shadow p-8">

          <h2 className="text-2xl font-bold mb-4">
            Financial Imports
          </h2>

          <p className="text-gray-500 mb-6">
            Import escalations, billing and operational financials.
          </p>

          <button className="bg-black text-white px-5 py-3 rounded-lg">
            Upload Financial File
          </button>

        </div>

      </div>

    </main>
  );
}