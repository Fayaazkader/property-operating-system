"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Check } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Preset = {
  id: string;
  preset_name: string;
  bank_name: string | null;
  is_default: boolean;
  column_mapping: Record<string, number>;
  amount_type: "single" | "dual";
  date_format: string;
  skip_rows: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onPresetSelected: (preset: Preset) => void;
}

export function BankImportPresets({ open, onClose, onPresetSelected }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) loadPresets();
  }, [open]);

  async function loadPresets() {
    const { data } = await supabase
      .from("bank_import_presets")
      .select("*")
      .order("is_default", { ascending: false })
      .order("preset_name");
    if (data) setPresets(data as Preset[]);
  }

  function startNew() {
    setEditingPreset({
      id: "",
      preset_name: "",
      bank_name: "",
      is_default: false,
      column_mapping: { date: 1, description: 2, amount: 3, reference: 4 },
      amount_type: "single",
      date_format: "DD/MM/YYYY",
      skip_rows: 0,
    });
    setIsNew(true);
    setSelectedPreset(null);
  }

  function startEdit(preset: Preset) {
    setEditingPreset({ ...preset, column_mapping: { ...preset.column_mapping } });
    setIsNew(false);
  }

  async function savePreset() {
    if (!editingPreset) return;
    setSaving(true);

    if (isNew) {
      const { data, error } = await supabase
        .from("bank_import_presets")
        .insert({
          preset_name: editingPreset.preset_name,
          bank_name: editingPreset.bank_name,
          column_mapping: editingPreset.column_mapping,
          amount_type: editingPreset.amount_type,
          date_format: editingPreset.date_format,
          skip_rows: editingPreset.skip_rows,
          is_default: false,
        })
        .select()
        .single();
      if (data) {
        setPresets([...presets, data as Preset]);
        setEditingPreset(null);
        setIsNew(false);
      }
    } else {
      const { error } = await supabase
        .from("bank_import_presets")
        .update({
          preset_name: editingPreset.preset_name,
          bank_name: editingPreset.bank_name,
          column_mapping: editingPreset.column_mapping,
          amount_type: editingPreset.amount_type,
          date_format: editingPreset.date_format,
          skip_rows: editingPreset.skip_rows,
        })
        .eq("id", editingPreset.id);
      if (!error) {
        setPresets(presets.map(p => p.id === editingPreset.id ? editingPreset : p));
        setEditingPreset(null);
      }
    }
    setSaving(false);
    loadPresets();
  }

  async function deletePreset(id: string) {
    await supabase.from("bank_import_presets").delete().eq("id", id);
    setPresets(presets.filter(p => p.id !== id));
    if (selectedPreset?.id === id) setSelectedPreset(null);
    if (editingPreset?.id === id) setEditingPreset(null);
  }

  function updateMapping(field: string, value: number) {
    if (!editingPreset) return;
    setEditingPreset({
      ...editingPreset,
      column_mapping: { ...editingPreset.column_mapping, [field]: value },
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-black border border-zinc-800 rounded-3xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-black z-10">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Bank Import Presets</p>
            <p className="text-xs text-zinc-600 mt-0.5">Configure CSV column mappings per bank</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex divide-x divide-zinc-800 min-h-[400px]">
          {/* Preset List */}
          <div className="w-64 flex-shrink-0 p-4 space-y-3">
            <button
              onClick={startNew}
              className="w-full rounded-2xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Preset
            </button>
            <div className="space-y-1">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => { setSelectedPreset(preset); setEditingPreset(null); setIsNew(false); }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors ${
                    selectedPreset?.id === preset.id
                      ? "bg-white text-black font-medium"
                      : "text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  <div className="truncate">{preset.preset_name}</div>
                  {preset.bank_name && (
                    <div className="text-xs text-zinc-500 truncate">{preset.bank_name}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Editor / Detail */}
          <div className="flex-1 p-6">
            {editingPreset ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Preset Name</label>
                    <input
                      type="text"
                      value={editingPreset.preset_name}
                      onChange={(e) => setEditingPreset({ ...editingPreset, preset_name: e.target.value })}
                      className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                      placeholder="e.g. My FNB Format"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Bank Name</label>
                    <input
                      type="text"
                      value={editingPreset.bank_name || ""}
                      onChange={(e) => setEditingPreset({ ...editingPreset, bank_name: e.target.value })}
                      className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                      placeholder="e.g. FNB"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 mb-3">Column Mapping (1 = first column)</label>
                  <div className="grid grid-cols-4 gap-3">
                    {["date", "description", "amount", "reference"].map((field) => (
                      <div key={field}>
                        <label className="block text-xs text-zinc-500 mb-1 capitalize">{field}</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={editingPreset.column_mapping[field] || 1}
                          onChange={(e) => updateMapping(field, parseInt(e.target.value) || 1)}
                          className="w-full rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-zinc-600 text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Amount Type</label>
                    <select
                      value={editingPreset.amount_type}
                      onChange={(e) => setEditingPreset({ ...editingPreset, amount_type: e.target.value as "single" | "dual" })}
                      className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                    >
                      <option value="single">Single Column</option>
                      <option value="dual">Debit + Credit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Date Format</label>
                    <select
                      value={editingPreset.date_format}
                      onChange={(e) => setEditingPreset({ ...editingPreset, date_format: e.target.value })}
                      className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Skip Rows</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={editingPreset.skip_rows}
                      onChange={(e) => setEditingPreset({ ...editingPreset, skip_rows: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 text-center"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => { setEditingPreset(null); setIsNew(false); }}
                    className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={savePreset}
                    disabled={!editingPreset.preset_name || saving}
                    className="rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40"
                  >
                    {saving ? "Saving..." : "Save Preset"}
                  </button>
                </div>
              </div>
            ) : selectedPreset ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedPreset.preset_name}</h3>
                  {selectedPreset.bank_name && (
                    <p className="text-sm text-zinc-400 mt-1">{selectedPreset.bank_name}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="text-xs text-zinc-500">Date Column</p>
                    <p className="text-white mt-1">Column {selectedPreset.column_mapping.date}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="text-xs text-zinc-500">Description Column</p>
                    <p className="text-white mt-1">Column {selectedPreset.column_mapping.description}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="text-xs text-zinc-500">Amount Column</p>
                    <p className="text-white mt-1">Column {selectedPreset.column_mapping.amount}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="text-xs text-zinc-500">Reference Column</p>
                    <p className="text-white mt-1">Column {selectedPreset.column_mapping.reference}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2">
                    <span className="text-zinc-500">Amount: </span>
                    <span className="text-white">{selectedPreset.amount_type === "single" ? "Single Column" : "Debit + Credit"}</span>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2">
                    <span className="text-zinc-500">Date: </span>
                    <span className="text-white">{selectedPreset.date_format}</span>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2">
                    <span className="text-zinc-500">Skip: </span>
                    <span className="text-white">{selectedPreset.skip_rows} rows</span>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => onPresetSelected(selectedPreset)}
                    className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Use This Preset
                  </button>
                  <button
                    onClick={() => startEdit(selectedPreset)}
                    className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deletePreset(selectedPreset.id)}
                    className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                Select a preset or create a new one
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}