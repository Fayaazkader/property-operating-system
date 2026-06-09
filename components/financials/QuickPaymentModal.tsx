"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Property = {
  id: string;
  property_name: string;
};

type Supplier = {
  id: string;
  supplier_name: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onPaymentRecorded: () => void;
}

export function QuickPaymentModal({ open, onClose, onPaymentRecorded }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paymentCode, setPaymentCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadProperties() {
      const { data } = await supabase
        .from("properties")
        .select("id, property_name")
        .order("property_name");
      if (data) setProperties(data);
    }
    async function loadSuppliers() {
  // Suppliers table not yet built — using empty array for now
  setSuppliers([]);
}
    loadProperties();
    loadSuppliers();
  }, []);

  useEffect(() => {
    const date = new Date();
    const code = `PAY-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    setPaymentCode(code);
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedProperty || !selectedSupplier || !amount) return;

    setIsSaving(true);

    const { error } = await supabase
      .from("bank_transactions")
      .insert({
        transaction_date: new Date().toISOString().split("T")[0],
        transaction_description: `Payment ${paymentCode} - Supplier`,
        transaction_amount: -Math.abs(parseFloat(amount)),
        transaction_reference: reference || paymentCode,
        transaction_type: "payment",
        allocation_status: "unallocated",
        queue: "review",
      });

    if (!error) {
      setSelectedProperty("");
      setSelectedSupplier("");
      setAmount("");
      setReference("");
      onPaymentRecorded();
      onClose();
    }

    setIsSaving(false);
  };

  const isValid = selectedProperty && selectedSupplier && parseFloat(amount) > 0;

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
              Record Payment
            </p>
            <p className="text-xs text-zinc-600 mt-0.5 font-mono">{paymentCode}</p>
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
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
            >
              <option value="">Select property...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.property_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Supplier</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
            >
              <option value="">Select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.supplier_name}</option>
              ))}
            </select>
          </div>

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
            <label className="block text-xs text-zinc-500 mb-1.5">Reference</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
              placeholder="e.g. Invoice number or payment reference"
            />
          </div>
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
            className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? "Recording..." : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}