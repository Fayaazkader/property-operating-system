"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { extractRulesFromLease } from "@/lib/revenue/rule-extractor";
import { PageHeader } from "../../components/layout/PageHeader";

export default function NewLeasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [leaseId, setLeaseId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [monthlyRental, setMonthlyRental] = useState("");
  const [escalationPercent, setEscalationPercent] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [parkingBays, setParkingBays] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function handleCreate() {
    if (!leaseId || !tenantName) {
      alert("Lease ID and Tenant Name are required.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("leases")
      .insert({
         client_id: "C001", 
        lease_id: leaseId,
        tenant_name: tenantName,
        property_name: propertyName || null,
        monthly_rental: monthlyRental ? parseFloat(monthlyRental) : null,
        escalation_percent: escalationPercent ? parseFloat(escalationPercent) : null,
        deposit_amount: depositAmount ? parseFloat(depositAmount) : null,
        parking_bays: parkingBays ? parseInt(parkingBays) : null,
        lease_start_date: startDate || null,
        lease_end_date: endDate || null,
        lease_status: "Active",
      })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      alert("Error creating lease: " + error.message);
    } else if (data) {
      await extractRulesFromLease(data.id);
      alert("Lease created successfully. Billing rules extracted.");
      router.push("/leases");
    }

    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader title="New Lease" subtitle="Create a new lease. Billing rules will be extracted automatically." />

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Lease ID *</label>
            <input type="text" value={leaseId} onChange={(e) => setLeaseId(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" placeholder="e.g. L004" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Tenant Name *</label>
            <input type="text" value={tenantName} onChange={(e) => setTenantName(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" placeholder="e.g. Shoprite SA" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Property Name</label>
            <input type="text" value={propertyName} onChange={(e) => setPropertyName(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" placeholder="e.g. Sandton Mall" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Monthly Rental</label>
            <input type="number" value={monthlyRental} onChange={(e) => setMonthlyRental(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Escalation %</label>
            <input type="number" value={escalationPercent} onChange={(e) => setEscalationPercent(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" placeholder="7" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Deposit Amount</label>
            <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Parking Bays</label>
            <input type="number" value={parkingBays} onChange={(e) => setParkingBays(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40"
        >
          {loading ? "Creating..." : "Create Lease"}
        </button>
      </div>
    </div>
  );
}