'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { leaseTemplateService } from '@/lib/lease/templates/service';
import type {
  LeaseTemplate,
  LeaseTemplateCategory,
} from '@/lib/lease/templates/types';

const CATEGORIES: {
  value: LeaseTemplateCategory;
  label: string;
}[] = [
  { value: 'industrial', label: 'Industrial' },
  { value: 'retail', label: 'Retail' },
  { value: 'office', label: 'Office' },
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'informal', label: 'Informal' },
  { value: 'other', label: 'Other' },
];

type FlowStep = 'details' | 'upload' | 'processing';

export default function LeaseTemplatesPage() {
  const [templates, setTemplates] = useState<LeaseTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<FlowStep>('details');

  const [entityId, setEntityId] = useState('');
  const [templateId, setTemplateId] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] =
    useState<LeaseTemplateCategory>('industrial');

  const [propertyTypes, setPropertyTypes] =
    useState<string[]>(['industrial']);

  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      return;
    }

    const { data: entities } = await supabase.rpc('auth_entities');
    const eid = entities?.[0];

    if (!eid) {
      setLoading(false);
      return;
    }

    setEntityId(eid);

    const { data } = await supabase
      .from('lease_templates')
      .select('*')
      .eq('entity_id', eid)
      .order('category')
      .order('version', { ascending: false });

    setTemplates(data || []);
    setLoading(false);
  }

  function resetFlow() {
    setShowCreate(false);
    setStep('details');
    setTemplateId('');
    setName('');
    setCategory('industrial');
    setPropertyTypes(['industrial']);
    setFile(null);
    setSaving(false);
    setError('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function togglePropertyType(type: string) {
    setPropertyTypes(prev =>
      prev.includes(type)
        ? prev.filter(v => v !== type)
        : [...prev, type]
    );
  }

  async function createDraft() {
    if (!entityId || !name.trim() || !propertyTypes.length) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const draft = await leaseTemplateService.createDraft({
        entityId,
        templateName: name.trim(),
        category,
        propertyIds: [],
        appliesToPropertyTypes: propertyTypes,
      });

      setTemplateId(draft.id);
      setStep('upload');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to create lease template.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadLease() {
    if (!file || !entityId || !templateId) return;

    setSaving(true);
    setError('');
    setStep('processing');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const formData = new FormData();
      console.log('LEASE FILE TYPE:', file.type);
console.log('LEASE FILE NAME:', file.name);

      formData.append('file', file);
      formData.append('entityId', entityId);
      formData.append('templateId', templateId);

      const response = await fetch('/api/lease-templates/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result?.error || 'Unable to analyse the lease document.'
        );
      }

      await load();
      resetFlow();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unable to process lease document.');
      setStep('upload');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-zinc-500">Loading...</div>;
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
            Lease Templates
          </h1>

          <p className="text-sm text-zinc-500 mt-1">
            Store your organisation&apos;s lease variants and control where
            they apply.
          </p>
        </div>

        <button
          onClick={() => {
            setError('');
            setShowCreate(true);
          }}
          className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100"
        >
          + Add Lease Template
        </button>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
        <p className="text-xs font-medium text-white mb-1">
          Your lease remains your legal document
        </p>

        <p className="text-xs leading-5 text-zinc-500">
          Upload your organisation&apos;s existing lease variants. AssetFlow
          analyses the document to identify fields and provide suggestions.
          AssetFlow does not rewrite or replace your legal lease.
        </p>
      </div>

      {!templates.length ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-10 text-center">
          <p className="text-sm text-zinc-400">
            No lease templates configured.
          </p>

          <p className="text-xs text-zinc-600 mt-2">
            Add your Industrial, Retail, Residential, Commercial or other
            lease variants.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left py-3 px-4 text-[10px] uppercase text-zinc-500">
                  Template
                </th>

                <th className="text-left py-3 px-4 text-[10px] uppercase text-zinc-500">
                  Category
                </th>

                <th className="text-left py-3 px-4 text-[10px] uppercase text-zinc-500">
                  Applies To
                </th>

                <th className="text-left py-3 px-4 text-[10px] uppercase text-zinc-500">
                  Version
                </th>

                <th className="text-left py-3 px-4 text-[10px] uppercase text-zinc-500">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {templates.map(template => (
                <tr
                  key={template.id}
                  className="border-b border-white/[0.03]"
                >
                  <td className="py-3 px-4 text-white text-xs">
                    {template.template_name}
                  </td>

                  <td className="py-3 px-4 text-zinc-400 text-xs capitalize">
                    {template.category}
                  </td>

                  <td className="py-3 px-4 text-zinc-400 text-xs">
                    {template.applies_to_property_types?.join(', ') || '—'}
                  </td>

                  <td className="py-3 px-4 text-zinc-400 text-xs">
                    v{template.version}
                  </td>

                  <td className="py-3 px-4 text-xs">
  <span
    className={
      template.status === 'active'
        ? 'text-emerald-400'
        : template.review_status === 'in_review'
          ? 'text-amber-400'
          : 'text-zinc-500'
    }
  >
    {template.status === 'draft'
      ? 'In Review'
      : template.status}
  </span>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => !saving && resetFlow()}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[var(--bg-primary)] p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Step {step === 'details' ? '1' : step === 'upload' ? '2' : '3'} of 3
                  </p>

                  <h2 className="text-sm font-medium text-white mt-1">
                    {step === 'details'
                      ? 'Define Lease Variant'
                      : step === 'upload'
                        ? 'Upload Your Lease'
                        : 'Analysing Lease'}
                  </h2>

                  <p className="text-xs text-zinc-500 mt-1">
                    {step === 'details'
                      ? 'Tell AssetFlow which lease this document represents.'
                      : step === 'upload'
                        ? 'Upload the actual legal lease used by your organisation.'
                        : 'AssetFlow is analysing the source document. It will not rewrite it.'}
                  </p>
                </div>

                <button
                  onClick={() => !saving && resetFlow()}
                  className="text-zinc-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-400">
                  {error}
                </div>
              )}

              {step === 'details' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                      Template Name
                    </label>

                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Standard Industrial Lease"
                      className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                      Lease Category
                    </label>

                    <select
                      value={category}
                      onChange={e => {
                        const value =
                          e.target.value as LeaseTemplateCategory;

                        setCategory(value);
                        setPropertyTypes([value]);
                      }}
                      className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none"
                    >
                      {CATEGORIES.map(item => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                      Applies To Property Types
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.map(item => {
                        const selected = propertyTypes.includes(
                          item.value
                        );

                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() =>
                              togglePropertyType(item.value)
                            }
                            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                              selected
                                ? 'border-white/20 bg-white/[0.06] text-white'
                                : 'border-white/[0.06] text-zinc-500'
                            }`}
                          >
                            {selected ? '✓ ' : ''}
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-xs text-zinc-300">
                      Your document stays the legal source.
                    </p>

                    <p className="text-[11px] text-zinc-600 mt-1 leading-5">
                      AssetFlow will analyse your lease, identify information
                      that can be populated during leasing, and provide
                      suggestions for your review.
                    </p>
                  </div>

                  <button
                    onClick={createDraft}
                    disabled={
                      saving ||
                      !name.trim() ||
                      !propertyTypes.length
                    }
                    className="w-full rounded-lg bg-white py-2.5 text-xs font-medium text-black disabled:opacity-40"
                  >
                    {saving ? 'Creating...' : 'Continue to Upload'}
                  </button>
                </div>
              )}

              {step === 'upload' && (
                <div className="space-y-5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e =>
                      setFile(e.target.files?.[0] || null)
                    }
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-12 text-center hover:bg-white/[0.04] transition"
                  >
                    <p className="text-sm text-white">
                      {file ? file.name : 'Choose your lease document'}
                    </p>

                    <p className="text-xs text-zinc-600 mt-2">
                      PDF, Word document or scanned/image lease
                    </p>
                  </button>

                  {file && (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-white">
                            {file.name}
                          </p>

                          <p className="text-[11px] text-zinc-600 mt-1">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);

                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="text-xs text-zinc-500 hover:text-white"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-xs text-zinc-300">
                      What AssetFlow will do
                    </p>

                    <ul className="mt-2 space-y-1 text-[11px] text-zinc-600">
                      <li>• Preserve your original lease.</li>
                      <li>• Extract candidate fields.</li>
                      <li>• Identify possible insertion points.</li>
                      <li>• Analyse the document for review suggestions.</li>
                      <li>• Leave all legal decisions to you.</li>
                    </ul>
                  </div>

                  <button
                    onClick={uploadLease}
                    disabled={saving || !file}
                    className="w-full rounded-lg bg-white py-2.5 text-xs font-medium text-black disabled:opacity-40"
                  >
                    Analyse Lease
                  </button>
                </div>
              )}

              {step === 'processing' && (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-5 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white" />

                  <p className="text-sm text-white">
                    Analysing your lease
                  </p>

                  <p className="text-xs text-zinc-600 mt-2">
                    The original document is being preserved. This may take a
                    moment.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}