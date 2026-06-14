"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { extractRulesFromLease } from "@/lib/revenue/rule-extractor";
import { PageHeader } from "../../components/layout/PageHeader";

const LEASE_TYPES = ["Retail", "Office", "Industrial", "Storage", "Residential", "Advertising", "Telecommunications"];
const RECOVERY_TYPES = ["Rates", "Insurance", "CID", "Generator", "Aircon", "Municipal", "Other"];
const SECTIONS = ["Lease Information", "Contacts & Legal", "Premises", "Commercial Terms", "Dates & Occupation", "Revenue Streams", "Documents", "Lease Intelligence"];

export default function NewLeasePage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  // Dropdown data
  const [entities, setEntities] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<any[]>([]);

  // Section 1: Lease Information
  const leaseNumber = `LSE-${Date.now().toString().slice(-8)}`;
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [industry, setIndustry] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [leaseType, setLeaseType] = useState("Retail");

  // Section 2: Contacts & Legal (now arrays)
  const [contacts, setContacts] = useState<{ name: string; role: string; email: string; mobile: string }[]>([]);
  const [signatories, setSignatories] = useState<{ name: string; idNumber: string; capacity: string }[]>([]);
  const [sureties, setSureties] = useState<{ name: string; idNumber: string }[]>([]);
  const [resolutions, setResolutions] = useState<{ date: string; number: string }[]>([]);

  // Section 3: Premises
  const [selectedProperty, setSelectedProperty] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [gla, setGla] = useState("");
  const [storageArea, setStorageArea] = useState("");
  const [parkingBays, setParkingBays] = useState("");
  const [parkingRate, setParkingRate] = useState("1000");
  const [floor, setFloor] = useState("");

  // Section 4: Commercial Terms
  const [baseRental, setBaseRental] = useState("");
  const [escalationPercent, setEscalationPercent] = useState("");
  const [escalationMonth, setEscalationMonth] = useState(new Date().getMonth() + 1);
  const [depositAmount, setDepositAmount] = useState("");
  const [bankGuarantee, setBankGuarantee] = useState("");
  const [hasTurnover, setHasTurnover] = useState(false);
  const [turnoverPercent, setTurnoverPercent] = useState("");
  const [turnoverBreakpoint, setTurnoverBreakpoint] = useState("");
  const [marketingLevy, setMarketingLevy] = useState("");
  const [securityLevy, setSecurityLevy] = useState("");
  const [enabledRecoveries, setEnabledRecoveries] = useState<string[]>([]);

  // Section 5: Dates
  const [leaseStart, setLeaseStart] = useState("");
  const [leaseEnd, setLeaseEnd] = useState("");
  const [boStart, setBoStart] = useState("");
  const [boEnd, setBoEnd] = useState("");
  const [rentalCommencement, setRentalCommencement] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("90");
  const [renewalOption, setRenewalOption] = useState(false);

  // Load dropdowns
  useEffect(() => {
    async function load() {
      const { data: ent } = await supabase.from("entities").select("id, entity_name").order("entity_name");
      const { data: props } = await supabase.from("properties").select("id, property_name, entity_id").order("property_name");
      const { data: tens } = await supabase.from("tenants").select("id, tenant_name, vat_number, company_registration, industry").order("tenant_name");
      if (ent) setEntities(ent);
      if (props) setProperties(props);
      if (tens) setTenants(tens);
    }
    load();
  }, []);

  // Filter properties by entity
  useEffect(() => {
    if (selectedEntity) {
      setFilteredProperties(properties.filter(p => p.entity_id === selectedEntity));
    } else {
      setFilteredProperties([]);
    }
  }, [selectedEntity, properties]);


  // Readiness calculation
  const requiredFields = [selectedEntity, selectedTenant, selectedProperty, baseRental, leaseStart, leaseEnd];
  const filledRequired = requiredFields.filter(f => !!f).length;
  const readiness = Math.round((filledRequired / requiredFields.length) * 70 + (depositAmount ? 1 : 0) * 10 + (signatories.length > 0 ? 1 : 0) * 10 + (vatNumber ? 1 : 0) * 10);

  // Revenue Streams
  const revenueStreams: { name: string; amount: string; frequency: string }[] = [];
  if (baseRental && parseFloat(baseRental) > 0) {
    revenueStreams.push({ name: "Base Rental", amount: `R${parseFloat(baseRental).toLocaleString()}`, frequency: "Monthly" });
  }
  if (parkingBays && parseFloat(parkingBays) > 0 && parseFloat(parkingRate) > 0) {
    revenueStreams.push({ name: "Parking", amount: `R${(parseFloat(parkingBays) * parseFloat(parkingRate)).toLocaleString()}`, frequency: "Monthly" });
  }
  if (depositAmount && parseFloat(depositAmount) > 0) {
    revenueStreams.push({ name: "Deposit", amount: `R${parseFloat(depositAmount).toLocaleString()}`, frequency: "Once" });
  }
  if (marketingLevy && parseFloat(marketingLevy) > 0) {
    revenueStreams.push({ name: "Marketing Levy", amount: `R${parseFloat(marketingLevy).toLocaleString()}`, frequency: "Monthly" });
  }
  if (securityLevy && parseFloat(securityLevy) > 0) {
    revenueStreams.push({ name: "Security Levy", amount: `R${parseFloat(securityLevy).toLocaleString()}`, frequency: "Monthly" });
  }
  if (hasTurnover && turnoverPercent) {
    revenueStreams.push({ name: "Turnover Rental", amount: `${turnoverPercent}% above R${turnoverBreakpoint || "0"}`, frequency: "Monthly" });
  }
  enabledRecoveries.forEach(r => {
    revenueStreams.push({ name: `${r} Recovery`, amount: "Variable", frequency: "Monthly" });
  });

  const warnings: string[] = [];
  if (!vatNumber) warnings.push("VAT Number missing — required for tax invoices");
  if (!depositAmount) warnings.push("Deposit not set");
  if (signatories.length === 0) warnings.push("No signatories recorded");
  if (!leaseStart || !leaseEnd) warnings.push("Lease dates incomplete");

  const annualRevenue = baseRental ? parseFloat(baseRental) * 12 : 0;

  // Add helpers
  function addContact() { setContacts([...contacts, { name: "", role: "", email: "", mobile: "" }]); }
  function addSignatory() { setSignatories([...signatories, { name: "", idNumber: "", capacity: "" }]); }
  function addSurety() { setSureties([...sureties, { name: "", idNumber: "" }]); }
  function addResolution() { setResolutions([...resolutions, { date: "", number: "" }]); }

 async function handleCreate() {
    if (!selectedEntity || !selectedTenant || !selectedProperty || !baseRental || !leaseStart) {
      alert("Please fill in all required fields: Entity, Tenant, Property, Rental, and Lease Start.");
      return;
    }
    setLoading(true);

    const { data: newTenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        tenant_name: selectedTenant,
        company_registration: registrationNumber || null,
        vat_number: vatNumber || null,
        industry: industry || null,
      })
      .select("id")
      .single();

    if (tenantError) {
      console.error(tenantError);
      alert("Error creating tenant: " + tenantError.message);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("leases")
      .insert({
        client_id: "C001",
        lease_id: leaseNumber,
        tenant_id: newTenant.id,
        property_id: selectedProperty,
        tenant_name: selectedTenant,
        property_name: properties.find(p => p.id === selectedProperty)?.property_name,
        monthly_rental: parseFloat(baseRental),
        escalation_percent: escalationPercent ? parseFloat(escalationPercent) : null,
        deposit_amount: depositAmount ? parseFloat(depositAmount) : null,
        parking_bays: parkingBays ? parseInt(parkingBays) : null,
        parking_rate: parkingRate ? parseFloat(parkingRate) : null,
        lease_start_date: leaseStart || null,
        lease_end_date: leaseEnd || null,
        lease_status: "Active",
        lease_type: leaseType,
        company_registration: registrationNumber || null,
        vat_number: vatNumber || null,
        notice_period_days: noticePeriod ? parseInt(noticePeriod) : 90,
        gla_sqm: gla ? parseFloat(gla) : null,
        security_levy: securityLevy ? parseFloat(securityLevy) : null,
        marketing_levy: marketingLevy ? parseFloat(marketingLevy) : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      alert("Error creating lease: " + error.message);
      setLoading(false);
    } else if (data) {
      await extractRulesFromLease(data.id);
      setSuccessData({
        leaseNumber,
        monthlyRental: parseFloat(baseRental),
        annualRevenue,
        revenueStreams: revenueStreams.length,
        nextEscalation: escalationPercent ? `${new Date(new Date().getFullYear(), escalationMonth - 1).toLocaleDateString("en-ZA", { month: "long" })} ${new Date().getFullYear() + 1}` : "N/A",
      });
      setShowSuccess(true);
      setLoading(false);
    }
  }

  if (showSuccess && successData) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 px-6 pt-20 pb-12 text-center">
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-10">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="text-3xl font-black text-white mb-2">Lease Created</h1>
          <p className="text-zinc-400 mb-2 font-mono">{successData.leaseNumber}</p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">Monthly Revenue</p>
              <p className="text-2xl font-bold text-white">R{successData.monthlyRental.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">Annual Revenue</p>
              <p className="text-2xl font-bold text-white">R{successData.annualRevenue.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">Revenue Streams</p>
              <p className="text-2xl font-bold text-white">{successData.revenueStreams}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">Next Escalation</p>
              <p className="text-2xl font-bold text-white">{successData.nextEscalation}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push(`/leases/${successData.leaseNumber}`)} className="rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-zinc-200">View Lease</button>
            <button onClick={() => router.push("/leases/new")} className="rounded-2xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Create Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader title="Create Lease" subtitle="Intelligent lease capture. Revenue starts here." />

      <div className="flex gap-3">
        <button className="rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold">📄 Upload Lease</button>
        <button className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300">✍️ Manual Entry</button>
      </div>

      <div className="flex gap-8">
        {/* Left Navigation */}
        <div className="w-56 flex-shrink-0 space-y-1">
          {SECTIONS.map((section, i) => (
            <button key={section} onClick={() => setActiveSection(i)}
              className={`w-full text-left px-4 py-2.5 rounded-2xl text-sm transition-colors ${activeSection === i ? "bg-white text-black font-medium" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}>
              {section}
            </button>
          ))}
        </div>

        {/* Right Form */}
        <div className="flex-1 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 min-h-[500px]">
          {/* Section 1: Lease Information */}
          {activeSection === 0 && (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Lease Information</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Lease Number</label>
                  <input type="text" value={leaseNumber} readOnly
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400 outline-none font-mono cursor-default" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Lease Type *</label>
                  <select value={leaseType} onChange={(e) => setLeaseType(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600">
                    {LEASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Entity *</label>
                  <select value={selectedEntity} onChange={(e) => { setSelectedEntity(e.target.value); setSelectedProperty(""); }}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600">
                    <option value="">Select entity...</option>
                    {entities.map(e => <option key={e.id} value={e.id}>{e.entity_name}</option>)}
                  </select>
                </div>
               <div>
  <label className="block text-xs text-zinc-500 mb-1.5">Tenant Name *</label>
  <input type="text" value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}
    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
    placeholder="Enter new tenant name" />
</div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Registration Number</label>
                  <input type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">VAT Number</label>
                  <input type="text" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Tax Number</label>
                  <input type="text" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Industry</label>
                  <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1.5">External Reference</label>
                  <input type="text" value={externalReference} onChange={(e) => setExternalReference(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" placeholder="e.g. Attorney file number, legacy system reference" />
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Contacts & Legal */}
          {activeSection === 1 && (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Contacts & Legal</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">Contacts</p>
                  <button onClick={addContact} className="text-xs text-blue-400 hover:text-blue-300">+ Add Contact</button>
                </div>
                {contacts.map((c, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2">
                    <input placeholder="Name" value={c.name} onChange={(e) => { const n = [...contacts]; n[i].name = e.target.value; setContacts(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                    <input placeholder="Role" value={c.role} onChange={(e) => { const n = [...contacts]; n[i].role = e.target.value; setContacts(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                    <input placeholder="Email" value={c.email} onChange={(e) => { const n = [...contacts]; n[i].email = e.target.value; setContacts(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                    <input placeholder="Mobile" value={c.mobile} onChange={(e) => { const n = [...contacts]; n[i].mobile = e.target.value; setContacts(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">Signatories</p>
                  <button onClick={addSignatory} className="text-xs text-blue-400 hover:text-blue-300">+ Add Signatory</button>
                </div>
                {signatories.map((s, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <input placeholder="Name" value={s.name} onChange={(e) => { const n = [...signatories]; n[i].name = e.target.value; setSignatories(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                    <input placeholder="ID Number" value={s.idNumber} onChange={(e) => { const n = [...signatories]; n[i].idNumber = e.target.value; setSignatories(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                    <input placeholder="Capacity" value={s.capacity} onChange={(e) => { const n = [...signatories]; n[i].capacity = e.target.value; setSignatories(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">Sureties</p>
                  <button onClick={addSurety} className="text-xs text-blue-400 hover:text-blue-300">+ Add Surety</button>
                </div>
                {sureties.map((s, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <input placeholder="Name" value={s.name} onChange={(e) => { const n = [...sureties]; n[i].name = e.target.value; setSureties(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                    <input placeholder="ID Number" value={s.idNumber} onChange={(e) => { const n = [...sureties]; n[i].idNumber = e.target.value; setSureties(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">Director Resolutions</p>
                  <button onClick={addResolution} className="text-xs text-blue-400 hover:text-blue-300">+ Add Resolution</button>
                </div>
                {resolutions.map((r, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <input type="date" value={r.date} onChange={(e) => { const n = [...resolutions]; n[i].date = e.target.value; setResolutions(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                    <input placeholder="Resolution Number" value={r.number} onChange={(e) => { const n = [...resolutions]; n[i].number = e.target.value; setResolutions(n); }}
                      className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Premises */}
          {activeSection === 2 && (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Premises</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Property *</label>
                  <select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600">
                    <option value="">Select property...</option>
                    {filteredProperties.map(p => <option key={p.id} value={p.id}>{p.property_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Unit Number</label>
                  <input type="text" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">GLA (sqm)</label>
                  <input type="number" value={gla} onChange={(e) => setGla(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Storage Area (sqm)</label>
                  <input type="number" value={storageArea} onChange={(e) => setStorageArea(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Parking Bays</label>
                  <input type="number" value={parkingBays} onChange={(e) => setParkingBays(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Parking Rate (R/bay)</label>
                  <input type="number" value={parkingRate} onChange={(e) => setParkingRate(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Floor</label>
                  <input type="text" value={floor} onChange={(e) => setFloor(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Commercial Terms */}
          {activeSection === 3 && (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Commercial Terms</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Base Rental (R) *</label>
                  <input type="number" value={baseRental} onChange={(e) => setBaseRental(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Escalation %</label>
                  <input type="number" value={escalationPercent} onChange={(e) => setEscalationPercent(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Escalation Month</label>
                  <select value={escalationMonth} onChange={(e) => setEscalationMonth(parseInt(e.target.value))}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600">
                    {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                      <option key={m} value={i+1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Deposit (R)</label>
                  <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Bank Guarantee (R)</label>
                  <input type="number" value={bankGuarantee} onChange={(e) => setBankGuarantee(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Marketing Levy (R)</label>
                  <input type="number" value={marketingLevy} onChange={(e) => setMarketingLevy(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Security Levy (R)</label>
                  <input type="number" value={securityLevy} onChange={(e) => setSecurityLevy(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" />
                </div>
              </div>
              
              {leaseType === "Retail" && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={hasTurnover} onChange={(e) => setHasTurnover(e.target.checked)} className="rounded" />
                    <span className="text-sm text-white">Turnover Rental</span>
                  </label>
                  {hasTurnover && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Turnover %</label>
                        <input type="number" value={turnoverPercent} onChange={(e) => setTurnoverPercent(e.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600 tabular-nums" />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Breakpoint (R)</label>
                        <input type="number" value={turnoverBreakpoint} onChange={(e) => setTurnoverBreakpoint(e.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600 tabular-nums" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-xs text-zinc-500 mb-3">Recovery Rules</p>
                <div className="grid grid-cols-2 gap-2">
                  {RECOVERY_TYPES.map(rec => (
                    <label key={rec} className="flex items-center gap-2">
                      <input type="checkbox" checked={enabledRecoveries.includes(rec)}
                        onChange={(e) => {
                          if (e.target.checked) setEnabledRecoveries([...enabledRecoveries, rec]);
                          else setEnabledRecoveries(enabledRecoveries.filter(r => r !== rec));
                        }} className="rounded" />
                      <span className="text-xs text-zinc-400">{rec}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Dates & Occupation */}
          {activeSection === 4 && (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Dates & Occupation</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-zinc-500 mb-1.5">Lease Start *</label><input type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" /></div>
                <div><label className="block text-xs text-zinc-500 mb-1.5">Lease End *</label><input type="date" value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" /></div>
                <div><label className="block text-xs text-zinc-500 mb-1.5">BO Start</label><input type="date" value={boStart} onChange={(e) => setBoStart(e.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" /></div>
                <div><label className="block text-xs text-zinc-500 mb-1.5">BO End</label><input type="date" value={boEnd} onChange={(e) => setBoEnd(e.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" /></div>
                <div><label className="block text-xs text-zinc-500 mb-1.5">Rental Commencement</label><input type="date" value={rentalCommencement} onChange={(e) => setRentalCommencement(e.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600" /></div>
                <div><label className="block text-xs text-zinc-500 mb-1.5">Notice Period (Days)</label><input type="number" value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums" /></div>
              </div>
              <label className="flex items-center gap-3 mt-2"><input type="checkbox" checked={renewalOption} onChange={(e) => setRenewalOption(e.target.checked)} className="rounded" /><span className="text-sm text-white">Renewal Option Available</span></label>
            </div>
          )}

          {/* Section 6: Revenue Streams */}
          {activeSection === 5 && (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Revenue Streams</p>
              {revenueStreams.length === 0 ? (
                <p className="text-zinc-500 text-sm">Enter Commercial Terms to generate revenue streams.</p>
              ) : (
                <div className="space-y-2">
                  {revenueStreams.map((rs, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
                      <span className="text-white">{rs.name}</span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-zinc-400">{rs.amount}</span>
                        <span className="text-zinc-500">{rs.frequency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 7: Documents */}
          {activeSection === 6 && (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Documents</p>
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-8 text-center">
                <p className="text-zinc-500">📄 Drag & drop lease documents here</p>
                <p className="text-xs text-zinc-600 mt-1">Lease Agreement, Suretyships, Guarantees, Resolutions, Addendums</p>
              </div>
            </div>
          )}

          {/* Section 8: Lease Intelligence */}
          {activeSection === 7 && (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Lease Intelligence</p>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">Lease Readiness</span>
                  <span className={`text-sm font-bold ${readiness >= 80 ? "text-emerald-400" : readiness >= 50 ? "text-amber-400" : "text-red-400"}`}>{readiness}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-800">
                  <div className={`h-2 rounded-full ${readiness >= 80 ? "bg-emerald-500" : readiness >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${readiness}%` }} />
                </div>
              </div>
              {warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-xs text-amber-300 mb-2">Warnings</p>
                  {warnings.map((w, i) => <p key={i} className="text-sm text-zinc-400">• {w}</p>)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs text-zinc-500">Monthly Revenue</p><p className="text-xl font-bold text-white">R{baseRental ? parseFloat(baseRental).toLocaleString() : "0"}</p></div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs text-zinc-500">Annual Revenue</p><p className="text-xl font-bold text-white">R{annualRevenue.toLocaleString()}</p></div>
              </div>
              <button onClick={handleCreate} disabled={loading}
                className="w-full rounded-2xl bg-white text-black px-6 py-4 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40">
                {loading ? "Creating..." : "Create Lease"}
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t border-zinc-800">
            <button onClick={() => setActiveSection(Math.max(0, activeSection - 1))} disabled={activeSection === 0}
              className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-30">← Previous</button>
            <span className="text-xs text-zinc-500 self-center">Section {activeSection + 1} of {SECTIONS.length}</span>
            <button onClick={() => setActiveSection(Math.min(SECTIONS.length - 1, activeSection + 1))} disabled={activeSection === SECTIONS.length - 1}
              className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-30">Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}