"use client";

import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import type { SplitAllocation } from "@/app/types/allocation";

type LookupData = {
  properties: { id: string; property_name: string; property_code?: string }[];
  leases: { id: string; lease_id: string; property_id: string; tenant_id: string; tenant_name?: string }[];
  tenants: { id: string; tenant_name: string; tenant_code?: string }[];
};

interface Props {
  line: SplitAllocation;
  index: number;
  lookupData: LookupData;
  currency?: string;
  onSave: (line: SplitAllocation) => void;
  onCancel: () => void;
}

const VAT_TREATMENTS = [
  { value: "vat-inclusive", label: "VAT Inclusive" },
  { value: "vat-exclusive", label: "VAT Exclusive" },
  { value: "no-vat", label: "No VAT (Deposit/Exempt)" },
] as const;

export function AllocationLineEdit({ line, index, lookupData, currency = "ZAR", onSave, onCancel }: Props) {
  const [form, setForm] = useState<SplitAllocation>({ ...line });
  const [editingField, setEditingField] = useState<"inclusive" | "exclusive" | null>(
    form.vatTreatment === "vat-exclusive" ? "exclusive" : "inclusive"
  );

  const filteredLeases = form.propertyId
    ? lookupData.leases.filter((l) => l.property_id === form.propertyId)
    : lookupData.leases;

  // Derive VAT and the other amount
  const inclusiveAmount = editingField === "inclusive" ? form.amount : 0;
  const exclusiveAmount = editingField === "exclusive" ? form.amount : 0;

  const calculatedVat = editingField === "inclusive" && form.amount > 0
    ? Math.round((form.amount - form.amount / 1.15) * 100) / 100
    : editingField === "exclusive" && form.amount > 0
    ? Math.round(form.amount * 0.15 * 100) / 100
    : 0;

  const displayInclusive = editingField === "inclusive" ? form.amount : form.amount + calculatedVat;
  const displayExclusive = editingField === "exclusive" ? form.amount : form.amount - calculatedVat;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(value);
  };

  const handleAmountChange = (value: number) => {
    const vat = editingField === "inclusive" && value > 0
      ? Math.round((value - value / 1.15) * 100) / 100
      : editingField === "exclusive" && value > 0
      ? Math.round(value * 0.15 * 100) / 100
      : 0;
    setForm((prev) => ({ ...prev, amount: value, vatAmount: vat }));
  };

  const handleSave = () => {
    onSave({
      ...form,
      amount: editingField === "inclusive" ? form.amount : form.amount + calculatedVat,
      vatAmount: calculatedVat,
    });
  };

  const isValid = form.amount > 0;

  return (
    <div className="rounded-3xl border border-zinc-700 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs text-zinc-400 font-mono">
          Allocation Line #{index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {/* Property */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Property</label>
          <select
            value={form.propertyId || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                propertyId: e.target.value || undefined,
                leaseId: undefined,
              }))
            }
            className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
          >
            <option value="">Select property...</option>
            {lookupData.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.property_name}
                {property.property_code ? ` (${property.property_code})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Lease */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Lease</label>
          <select
            value={form.leaseId || ""}
            onChange={(e) => {
              const leaseId = e.target.value || undefined;
              const selectedLease = leaseId
                ? lookupData.leases.find((l) => l.id === leaseId)
                : null;
              setForm((prev) => ({
                ...prev,
                leaseId,
                tenantId: selectedLease?.tenant_id || prev.tenantId,
              }));
            }}
            disabled={!form.propertyId}
            className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <option value="">Select lease...</option>
            {filteredLeases.map((lease) => (
              <option key={lease.id} value={lease.id}>
                {lease.lease_id}
                {lease.tenant_name ? ` — ${lease.tenant_name}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Tenant */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Tenant</label>
          <select
            value={form.tenantId || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                tenantId: e.target.value || undefined,
              }))
            }
            className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
          >
            <option value="">Select tenant...</option>
            {lookupData.tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.tenant_name}
                {tenant.tenant_code ? ` (${tenant.tenant_code})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* GL Code */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">GL Code</label>
          <input
            type="text"
            value={form.glAccountCode || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, glAccountCode: e.target.value || undefined }))
            }
            className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 font-mono"
            placeholder="e.g. 6100-001"
          />
        </div>

        {/* VAT Treatment */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">VAT Treatment</label>
          <select
            value={form.vatTreatment || "vat-inclusive"}
            onChange={(e) => {
              const treatment = e.target.value as SplitAllocation["vatTreatment"];
              setEditingField(treatment === "vat-exclusive" ? "exclusive" : "inclusive");
              setForm((prev) => ({
                ...prev,
                vatTreatment: treatment,
                amount: 0,
                vatAmount: 0,
              }));
            }}
            className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
          >
            {VAT_TREATMENTS.map((vt) => (
              <option key={vt.value} value={vt.value}>
                {vt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Amount fields — Excl / VAT / Incl */}
      {form.vatTreatment !== "no-vat" ? (
        <div className="mt-5 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Excl. VAT</label>
            <input
              type="number"
              step="0.01"
              value={editingField === "exclusive" ? form.amount || "" : displayExclusive || ""}
              onChange={(e) => {
                setEditingField("exclusive");
                handleAmountChange(parseFloat(e.target.value) || 0);
              }}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">VAT (15%)</label>
            <input
              type="number"
              value={calculatedVat || ""}
              readOnly
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400 tabular-nums cursor-default"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Incl. VAT</label>
            <input
              type="number"
              step="0.01"
              value={editingField === "inclusive" ? form.amount || "" : displayInclusive || ""}
              onChange={(e) => {
                setEditingField("inclusive");
                handleAmountChange(parseFloat(e.target.value) || 0);
              }}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums"
              placeholder="0.00"
            />
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <label className="block text-xs text-zinc-500 mb-1.5">Amount (No VAT)</label>
          <input
            type="number"
            step="0.01"
            value={form.amount || ""}
            onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
            className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums"
            placeholder="0.00"
          />
        </div>
      )}

      {/* Notes */}
      <div className="mt-4">
        <label className="block text-xs text-zinc-500 mb-1.5">Notes</label>
        <input
          type="text"
          value={form.notes || ""}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
          placeholder="Optional note..."
        />
      </div>
    </div>
  );
}