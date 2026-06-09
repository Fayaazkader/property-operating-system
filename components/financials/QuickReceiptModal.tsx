"use client";

import { useState, useEffect } from "react";
import { X, Plus, Minus } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Property = {
  id: string;
  property_name: string;
};

type Tenant = {
  id: string;
  tenant_name: string;
};

type SplitLine = {
  id: string;
  category: "Rent" | "Electricity" | "Water" | "Other";
  amount: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onReceiptIssued: () => void;
}

export function QuickReceiptModal({ open, onClose, onReceiptIssued }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<"Rent" | "Electricity" | "Water" | "Other">("Rent");
  const [receiptCode, setReceiptCode] = useState("");
  const [isSplit, setIsSplit] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLine[]>([
    { id: "1", category: "Rent", amount: 0 },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadProperties() {
      const { data } = await supabase
        .from("properties")
        .select("id, property_name")
        .order("property_name");
      if (data) setProperties(data);
    }
    loadProperties();
  }, []);

  useEffect(() => {
    async function loadTenants() {
      if (!selectedProperty) {
        setTenants([]);
        return;
      }
      const { data } = await supabase
        .from("leases")
        .select("id, tenant_id, tenants(id, tenant_name)")
        .eq("property_id", selectedProperty);

      if (data) {
        const uniqueTenants = new Map();
        data.forEach((lease: any) => {
          if (lease.tenants) {
            uniqueTenants.set(lease.tenants.id, lease.tenants);
          }
        });
        setTenants(Array.from(uniqueTenants.values()));
      }
    }
    loadTenants();
  }, [selectedProperty]);

  useEffect(() => {
    const date = new Date();
    const code = `REC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    setReceiptCode(code);
  }, [open]);

  const splitTotal = splitLines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const remaining = parseFloat(amount || "0") - splitTotal;

  const handleAddSplitLine = () => {
    setSplitLines([
      ...splitLines,
      { id: String(Date.now()), category: "Rent", amount: 0 },
    ]);
  };

  const handleRemoveSplitLine = (id: string) => {
    if (splitLines.length > 1) {
      setSplitLines(splitLines.filter((line) => line.id !== id));
    }
  };

  const handleSplitLineChange = (id: string, field: "category" | "amount", value: string | number) => {
    setSplitLines(
      splitLines.map((line) =>
        line.id === id ? { ...line, [field]: value } : line
      )
    );
  };

  const handleFillRemainder = (id: string) => {
    if (remaining > 0) {
      setSplitLines(
        splitLines.map((line) =>
          line.id === id ? { ...line, amount: line.amount + remaining } : line
        )
      );
    }
  };

  const handleSubmit = async () => {
    if (!selectedProperty || !selectedTenant || !amount) return;

    setIsSaving(true);

    const { error } = await supabase
      .from("bank_transactions")
      .insert({
        transaction_date: new Date().toISOString().split("T")[0],
        transaction_description: `Receipt ${receiptCode} - ${category}`,
        transaction_amount: parseFloat(amount),
        transaction_reference: receiptCode,
        transaction_type: "deposit",
        allocation_status: "fully_allocated",
        queue: "posted",
      });

    if (!error) {
      setSelectedProperty("");
      setSelectedTenant("");
      setAmount("");
      setCategory("Rent");
      setIsSplit(false);
      setSplitLines([{ id: "1", category: "Rent", amount: 0 }]);
      onReceiptIssued();
      onClose();
    }

    setIsSaving(false);
  };

  const isValid = selectedProperty && selectedTenant && parseFloat(amount) > 0 && (!isSplit || Math.abs(remaining) < 0.01);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-black border border-zinc-800 rounded-3xl w-full max-w-md mx-4 shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">
              Issue Receipt
            </p>
            <p className="text-xs text-zinc-600 mt-0.5 font-mono">{receiptCode}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Property</label>
            <select
              value={selectedProperty}
              onChange={(e) => {
                setSelectedProperty(e.target.value);
                setSelectedTenant("");
              }}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
            >
              <option value="">Select property...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.property_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Tenant</label>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              disabled={!selectedProperty}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <option value="">Select tenant...</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.tenant_name}</option>
              ))}
            </select>
          </div>

          {!isSplit && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">For</label>
              <div className="grid grid-cols-4 gap-2">
                {(["Rent", "Electricity", "Water", "Other"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                      category === cat
                        ? "bg-white text-black"
                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 tabular-nums"
              placeholder="0.00"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setIsSplit(!isSplit)}
              className={`text-xs transition-colors ${
                isSplit ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {isSplit ? "— Remove Split" : "+ Split Payment"}
            </button>
          </div>

          {isSplit && (
            <div className="space-y-3">
              <div className="border-t border-zinc-800 pt-3">
                <p className="text-xs text-zinc-500 mb-3">Split Breakdown</p>
                {splitLines.map((line) => (
                  <div key={line.id} className="flex items-center gap-2 mb-2">
                    <select
                      value={line.category}
                      onChange={(e) =>
                        handleSplitLineChange(line.id, "category", e.target.value)
                      }
                      className="flex-1 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600"
                    >
                      <option value="Rent">Rent</option>
                      <option value="Electricity">Electricity</option>
                      <option value="Water">Water</option>
                      <option value="Other">Other</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={line.amount || ""}
                      onChange={(e) =>
                        handleSplitLineChange(line.id, "amount", parseFloat(e.target.value) || 0)
                      }
                      className="w-28 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600 tabular-nums"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => handleFillRemainder(line.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 px-1"
                    >
                      Fill
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSplitLine(line.id)}
                      disabled={splitLines.length <= 1}
                      className="p-1 text-zinc-500 hover:text-red-400 disabled:opacity-30"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddSplitLine}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mt-2"
                >
                  <Plus className="w-3 h-3" />
                  Add Line
                </button>
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Total: R{splitTotal.toLocaleString()}</span>
                {remaining !== 0 && (
                  <span className="text-amber-400">
                    Remaining: R{remaining.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSaving}
            className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? "Issuing..." : "Apply & Issue Receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}