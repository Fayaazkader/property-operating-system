"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { propertyService } from "@/lib/platform/admin/property/service";
import { leaseNumberService } from "@/lib/workflow/services/lease-number-service";

const STEPS = [
  { key: "workspace", label: "Workspace Created", done: true },
  { key: "property", label: "Add your first Property", done: false },
  { key: "premises", label: "Add a Premises", done: false },
  { key: "tenant", label: "Add your first Tenant", done: false },
  { key: "lease", label: "Create your first Lease", done: false },
];

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityId = searchParams.get("entity");
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<string[]>(["workspace"]);
  const [loading, setLoading] = useState(false);

  // Property fields
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyGLA, setPropertyGLA] = useState("");

  // Premises fields
  const [premisesName, setPremisesName] = useState("");
  const [premisesGLA, setPremisesGLA] = useState("");

  // Tenant fields
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");

  // Lease fields
  const [leaseStart, setLeaseStart] = useState("");
  const [leaseEnd, setLeaseEnd] = useState("");
  const [monthlyRental, setMonthlyRental] = useState("");

  // Created IDs for linking
  const [propertyId, setPropertyId] = useState("");
  const [premisesId, setPremisesId] = useState("");
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      if (!entityId) {
        router.push("/app");
        return;
      }

      const { data: membership, error } = await supabase
        .from("user_entity_access")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("entity_id", entityId)
        .maybeSingle();

      if (error || !membership) {
        router.push("/app");
      }
    }

    check();
  }, [entityId, router]);

  async function handleCreateProperty() {
    if (!propertyName || !entityId) return;
    setLoading(true);

    try {
      const property = await propertyService.create({
        property_name: propertyName,
        address_line_1: propertyAddress || undefined,
        entity_id: entityId,
      });

      if (!property?.id) {
        throw new Error("Property was created without an ID.");
      }

      setPropertyId(property.id);
      setCompleted([...completed, "property"]);
      nextStep();
    } catch (error) {
      alert(
        "Error creating property: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePremises() {
    if (!premisesName || !propertyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("units")
      .insert({
        unit_number: premisesName,
        unit_name: premisesName,
        property_id: propertyId,
        gla_sqm: parseFloat(premisesGLA) || null,
        occupancy_status: "Vacant",
        operational_status: "Active",
      })
      .select("id")
      .single();

    if (error || !data) {
      setLoading(false);
      alert("Error creating premises: " + (error?.message || "Unknown error"));
      return;
    }

    setPremisesId(data.id);
    setCompleted([...completed, "premises"]);
    nextStep();
    setLoading(false);
  }

  async function handleCreateTenant() {
    if (!tenantName || !entityId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("tenants")
      .insert({
        tenant_name: tenantName,
        email: tenantEmail || null,
        phone: tenantPhone || null,
        entity_id: entityId,
        kyc_status: "Pending",
      })
      .select("id")
      .single();

    if (error || !data) {
      setLoading(false);
      alert("Error creating tenant: " + (error?.message || "Unknown error"));
      return;
    }

    setTenantId(data.id);
    setCompleted([...completed, "tenant"]);
    nextStep();
    setLoading(false);
  }

  async function handleCreateLease() {
    if (!monthlyRental || !tenantId || !propertyId || !entityId) return;
    setLoading(true);

    try {
      const { data: property, error: propertyError } = await supabase
        .from("properties")
        .select("property_code")
        .eq("id", propertyId)
        .single();

      if (propertyError || !property) {
        throw new Error(
          propertyError?.message || "Unable to load the selected property.",
        );
      }

      const propertyCode = property.property_code || "PRP";
      const leaseRef = await leaseNumberService.generate(propertyCode);

      const { data: lease, error } = await supabase
        .from("leases")
        .insert({
          client_id: tenantId,
          tenant_id: tenantId,
          property_id: propertyId,
          unit_id: premisesId,
          owner_entity_id: entityId,
          managing_entity_id: entityId,
          lease_id: leaseRef,
          tenant_name: tenantName,
          property_name: propertyName,
          unit_number: premisesName || null,
          monthly_rental: parseFloat(monthlyRental),
          lease_start_date: leaseStart || null,
          lease_end_date: leaseEnd || null,
          lease_status: "Active",
          billing_frequency: "monthly",
        })
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (premisesId) {
        const { error: unitError } = await supabase
          .from("units")
          .update({
            occupancy_status: "Occupied",
            current_tenant_name: tenantName,
            current_lease_id: lease.id,
          })
          .eq("id", premisesId);

        if (unitError) {
          throw new Error(
            `Lease was created, but the premises could not be updated: ${unitError.message}`,
          );
        }
      }

      setCompleted([...completed, "lease"]);
      nextStep();
    } catch (error) {
      alert(
        "Error creating lease: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setLoading(false);
    }
  }

  function nextStep() {
    setStep(step + 1);
  }

  function handleFinish() {
    router.push("/");
  }

  const currentStep = step < STEPS.length ? STEPS[step] : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="relative w-full max-w-lg">
        <div className="text-center mb-6">
          <p className="text-2xl font-bold tracking-tight text-white">
            AssetFlow
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-8">
          {/* Progress */}
          <div className="flex items-center gap-1.5 mb-8 justify-center">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`h-1 flex-1 rounded-full transition-all ${completed.includes(s.key) ? "bg-emerald-500" : i === step ? "bg-white/30" : "bg-white/[0.06]"}`}
              />
            ))}
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-2">
                <span className="text-2xl">✓</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  Welcome to AssetFlow
                </h1>
                <p className="text-sm text-zinc-500 mt-2 font-light">
                  Your workspace is ready. Let's build your portfolio.
                </p>
              </div>
              <button
                onClick={nextStep}
                className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 1: Property */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Step 1
              </p>
              <h1 className="text-xl font-semibold text-white">
                Add your first Property
              </h1>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                  Property Name
                </label>
                <input
                  type="text"
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  placeholder="Sandton Mall"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  placeholder="1 Rivonia Road, Sandton"
                />
              </div>
              <button
                onClick={handleCreateProperty}
                disabled={loading || !propertyName}
                className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all"
              >
                {loading ? "Creating..." : "Create Property"}
              </button>
            </div>
          )}

          {/* Step 2: Premises */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Step 2
              </p>
              <h1 className="text-xl font-semibold text-white">
                Add a Premises
              </h1>
              <p className="text-sm text-zinc-500">{propertyName}</p>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                  Unit/Suite Name
                </label>
                <input
                  type="text"
                  value={premisesName}
                  onChange={(e) => setPremisesName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  placeholder="Suite 101"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                  GLA (m²)
                </label>
                <input
                  type="number"
                  value={premisesGLA}
                  onChange={(e) => setPremisesGLA(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  placeholder="150"
                />
              </div>
              <button
                onClick={handleCreatePremises}
                disabled={loading || !premisesName}
                className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all"
              >
                {loading ? "Creating..." : "Add Premises"}
              </button>
              <button
                onClick={nextStep}
                className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Step 3: Tenant */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Step 3
              </p>
              <h1 className="text-xl font-semibold text-white">
                Add your first Tenant
              </h1>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                  Tenant Name
                </label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  placeholder="Acme Corp"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                    placeholder="tenant@acme.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={tenantPhone}
                    onChange={(e) => setTenantPhone(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                    placeholder="+27 11 123 4567"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateTenant}
                disabled={loading || !tenantName}
                className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all"
              >
                {loading ? "Creating..." : "Add Tenant"}
              </button>
              <button
                onClick={handleFinish}
                className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Step 4: Lease */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Step 4
              </p>
              <h1 className="text-xl font-semibold text-white">
                Create your first Lease
              </h1>
              <p className="text-sm text-zinc-500">
                {tenantName} — {propertyName} {premisesName}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={leaseStart}
                    onChange={(e) => setLeaseStart(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={leaseEnd}
                    onChange={(e) => setLeaseEnd(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                  Monthly Rental (R)
                </label>
                <input
                  type="number"
                  value={monthlyRental}
                  onChange={(e) => setMonthlyRental(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                  placeholder="25000"
                />
              </div>
              <button
                onClick={handleCreateLease}
                disabled={loading || !monthlyRental || !tenantId || !propertyId}
                className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all"
              >
                {loading ? "Creating..." : "Create Lease"}
              </button>
              <button
                onClick={handleFinish}
                className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Done */}
          {step >= 5 && (
            <div className="space-y-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-2">
                <span className="text-2xl">✓</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  You're all set
                </h1>
                <p className="text-sm text-zinc-500 mt-2 font-light">
                  You've created your first commercial property portfolio.
                </p>
              </div>
              <div className="text-left bg-white/[0.02] rounded-xl p-4 space-y-1.5 text-sm">
                {completed.map((k) => {
                  const s = STEPS.find((x) => x.key === k);
                  return (
                    <p
                      key={k}
                      className="text-emerald-400 font-light flex items-center gap-2"
                    >
                      <span className="text-xs">✓</span> {s?.label}
                    </p>
                  );
                })}
              </div>
              <button
                onClick={handleFinish}
                className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all"
              >
                Enter AssetFlow
              </button>
            </div>
          )}
        </div>

        {step > 0 && step < 5 && (
          <p className="mt-4 text-center">
            <button
              onClick={handleFinish}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Skip setup, go to dashboard
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
