'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, 
  Save, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Car, 
  DollarSign, 
  Percent, 
  FileText,
  Users,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Clock,
  History,
  Upload,
  Hash
} from "lucide-react";
import CustomDropdown from "@/app/components/ui/CustomDropdown";

const OPPORTUNITY_STAGES = [
  { key: "offer_received", label: "Offer Received", icon: FileText },
  { key: "commercial_review", label: "Commercial Review", icon: Clock },
  { key: "negotiation", label: "Negotiation", icon: AlertCircle },
  { key: "lease_draft", label: "Lease Draft", icon: FileText },
  { key: "signature", label: "Signature", icon: CheckCircle },
  { key: "activation", label: "Activation", icon: CheckCircle },
];

export default function NewLeaseIntakePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStage, setCurrentStage] = useState(0);
  const [opportunityRef, setOpportunityRef] = useState('OPP-2026-0001');
  
  const [formData, setFormData] = useState({
    broker_id: '',
    broker_company: '',
    applicant_name: '',
    company_registration: '',
    contact_email: '',
    contact_phone: '',
    property_id: '',
    unit_id: '',
    tenant_id: '',
    entity_id: '',
    
    // Commercial Terms
    lease_term_months: '36',
    commencement_date: '',
    expiry_date: '',
    parking_bays: '0',
    gla_sqm: '',
    special_conditions: '',
    
    // Financial Terms
    monthly_rental: '',
    deposit_amount: '',
    escalation_percent: '5',
    rent_free_period: '',
    fitout_allowance: '',
    
    // Negotiation
    negotiation_notes: '',
    
    status: 'offer_received',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    
    const [tenantsRes, propertiesRes, unitsRes, brokersRes, refRes] = await Promise.all([
      supabase.from('tenants').select('id, tenant_name, entity_id').limit(100),
      supabase.from('properties').select('id, property_name, entity_id, total_gla_sqm').limit(100),
      supabase.from('units').select('id, unit_number, property_id, gla_sqm').limit(100),
      supabase.from('brokers').select('id, name, company').limit(100),
      supabase.from('lease_intake').select('intake_code').order('created_at', { ascending: false }).limit(1),
    ]);
    
    if (tenantsRes.data) setTenants(tenantsRes.data);
    if (propertiesRes.data) setProperties(propertiesRes.data);
    if (unitsRes.data) setUnits(unitsRes.data);
    if (brokersRes.data) setBrokers(brokersRes.data);
    
    // Generate opportunity reference
    const lastRef = refRes.data?.[0]?.intake_code;
    if (lastRef) {
      const num = parseInt(lastRef.split('-')[2]) + 1;
      setOpportunityRef(`OPP-2026-${String(num).padStart(4, '0')}`);
    }
    
    setLoading(false);
  }

  function updateField(field: string, value: any) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  const filteredUnits = units.filter(u => u.property_id === formData.property_id);
  
  const suggestedExpiry = formData.commencement_date && formData.lease_term_months
    ? new Date(new Date(formData.commencement_date).setMonth(
        new Date(formData.commencement_date).getMonth() + parseInt(formData.lease_term_months)
      )).toISOString().split('T')[0]
    : '';

  const summary = {
    rental: formData.monthly_rental ? `R${parseFloat(formData.monthly_rental).toLocaleString()}` : '—',
    deposit: formData.deposit_amount ? `R${parseFloat(formData.deposit_amount).toLocaleString()}` : '—',
    escalation: formData.escalation_percent ? `${formData.escalation_percent}%` : '—',
    term: formData.lease_term_months ? `${formData.lease_term_months} months` : '—',
    expiry: suggestedExpiry || formData.expiry_date || '—',
    parking: formData.parking_bays ? `${formData.parking_bays} bays` : '—',
    gla: formData.gla_sqm ? `${formData.gla_sqm} sqm` : '—',
    rent_free: formData.rent_free_period ? `${formData.rent_free_period} months` : '—',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get entity from property
      let entityId = formData.entity_id;
      if (formData.property_id) {
        const prop = properties.find(p => p.id === formData.property_id);
        if (prop?.entity_id) entityId = prop.entity_id;
      }
      
      const { data, error } = await supabase
        .from('lease_intake')
        .insert({
          broker_id: formData.broker_id || null,
          broker_company: formData.broker_company || null,
          applicant_name: formData.applicant_name,
          company_registration: formData.company_registration,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone,
          property_id: formData.property_id || null,
          unit_id: formData.unit_id || null,
          tenant_id: formData.tenant_id || null,
          entity_id: entityId || null,
          
          monthly_rental: parseFloat(formData.monthly_rental) || null,
          deposit_amount: parseFloat(formData.deposit_amount) || null,
          escalation_percent: parseFloat(formData.escalation_percent) || 0,
          lease_term_months: parseInt(formData.lease_term_months) || null,
          commencement_date: formData.commencement_date || null,
          expiry_date: suggestedExpiry || formData.expiry_date || null,
          parking_bays: parseInt(formData.parking_bays) || 0,
          gla_sqm: parseFloat(formData.gla_sqm) || null,
          
          negotiation_notes: formData.negotiation_notes,
          special_conditions: formData.special_conditions,
          rent_free_period: parseInt(formData.rent_free_period) || null,
          fitout_allowance: parseFloat(formData.fitout_allowance) || null,
          
          status: 'offer_received',
          
          created_by: user?.id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      router.push(`/leasing/${data.id}`);
      
    } catch (error) {
      console.error('Error creating opportunity:', error);
      alert(error instanceof Error ? error.message : 'Failed to create opportunity');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 pt-8 pb-12">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-[var(--bg-elevated)] animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-[var(--bg-elevated)] rounded animate-pulse" />
            <div className="h-4 w-64 bg-[var(--bg-elevated)] rounded animate-pulse" />
          </div>
        </div>
        <div className="mt-8 space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-[var(--bg-elevated)] rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">New Commercial Opportunity</h1>
              <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)] px-3 py-1 rounded-full">
                <Hash className="w-3 h-3 inline mr-1" />
                {opportunityRef}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">Enter the offer to lease details</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-[var(--border-default)] px-5 py-2.5 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Creating...' : 'Create Opportunity'}
          </button>
        </div>
      </div>

      {/* Status Pipeline */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 mb-8">
        <div className="flex items-center gap-2">
          {OPPORTUNITY_STAGES.map((stage, index) => {
            const isActive = index <= currentStage;
            const isCurrent = index === currentStage;
            return (
              <div key={stage.key} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isCurrent ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 
                  isActive ? 'bg-emerald-500/10 text-emerald-300' : 
                  'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                }`}>
                  <stage.icon className="w-3 h-3" />
                  {stage.label}
                </div>
                {index < OPPORTUNITY_STAGES.length - 1 && (
                  <span className="text-[var(--text-muted)] text-xs">→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-8">
        {/* Main Content - 2 columns */}
        <div className="col-span-2 space-y-8">
          {/* Opportunity Section */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[var(--text-muted)]" /> Opportunity
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Broker</label>
                <CustomDropdown
                  options={brokers.map(b => ({ value: b.id, label: b.name }))}
                  value={formData.broker_id}
                  onChange={(val) => updateField('broker_id', val)}
                  placeholder="Select broker..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Broker Company</label>
                <input
                  type="text"
                  value={formData.broker_company}
                  onChange={(e) => updateField('broker_company', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1"
                  placeholder="API Properties"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Applicant *</label>
                <input
                  type="text"
                  required
                  value={formData.applicant_name}
                  onChange={(e) => updateField('applicant_name', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1"
                  placeholder="Acme Consulting (Pty) Ltd"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Registration Number</label>
                <input
                  type="text"
                  value={formData.company_registration}
                  onChange={(e) => updateField('company_registration', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1"
                  placeholder="2026/123456/07"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Contact Email *</label>
                <input
                  type="email"
                  required
                  value={formData.contact_email}
                  onChange={(e) => updateField('contact_email', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1"
                  placeholder="leasing@acmeconsulting.co.za"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Contact Phone</label>
                <input
                  type="text"
                  value={formData.contact_phone}
                  onChange={(e) => updateField('contact_phone', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1"
                  placeholder="+27 82 555 1234"
                />
              </div>
            </div>
          </div>

          {/* Property & Unit */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--text-muted)]" /> Property & Unit
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Property *</label>
                <CustomDropdown
                  options={properties.map(p => ({ value: p.id, label: p.property_name }))}
                  value={formData.property_id}
                  onChange={(val) => {
                    updateField('property_id', val);
                    updateField('unit_id', '');
                    const prop = properties.find(p => p.id === val);
                    if (prop?.total_gla_sqm) updateField('gla_sqm', prop.total_gla_sqm);
                    if (prop?.entity_id) updateField('entity_id', prop.entity_id);
                  }}
                  placeholder="Select property..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Unit *</label>
                <CustomDropdown
                  options={filteredUnits.map(u => ({ value: u.id, label: `Unit ${u.unit_number}` }))}
                  value={formData.unit_id}
                  onChange={(val) => {
                    updateField('unit_id', val);
                    const unit = units.find(u => u.id === val);
                    if (unit?.gla_sqm) updateField('gla_sqm', unit.gla_sqm);
                  }}
                  placeholder="Select unit..."
                  className="mt-1"
                  disabled={!formData.property_id}
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Tenant *</label>
                <CustomDropdown
                  options={tenants.map(t => ({ value: t.id, label: t.tenant_name }))}
                  value={formData.tenant_id}
                  onChange={(val) => updateField('tenant_id', val)}
                  placeholder="Select tenant..."
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Commercial Terms */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--text-muted)]" /> Commercial Terms
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Term (months) *</label>
                <input
                  type="number"
                  required
                  value={formData.lease_term_months}
                  onChange={(e) => updateField('lease_term_months', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums"
                  placeholder="36"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Commencement Date *</label>
                <input
                  type="date"
                  required
                  value={formData.commencement_date}
                  onChange={(e) => updateField('commencement_date', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Suggested Expiry</label>
                <input
                  type="text"
                  value={suggestedExpiry || '—'}
                  disabled
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-muted)] mt-1"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Parking Bays</label>
                <input
                  type="number"
                  value={formData.parking_bays}
                  onChange={(e) => updateField('parking_bays', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">GLA (sqm)</label>
                <input
                  type="number"
                  value={formData.gla_sqm}
                  onChange={(e) => updateField('gla_sqm', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums"
                  placeholder="250"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Special Conditions</label>
                <input
                  type="text"
                  value={formData.special_conditions}
                  onChange={(e) => updateField('special_conditions', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1"
                  placeholder="Fit-out allowance, exclusivity..."
                />
              </div>
            </div>
          </div>

          {/* Financial Terms */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[var(--text-muted)]" /> Financial Terms
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Monthly Rental (R) *</label>
                <input
                  type="number"
                  required
                  value={formData.monthly_rental}
                  onChange={(e) => updateField('monthly_rental', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums"
                  placeholder="52500"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Deposit (R) *</label>
                <input
                  type="number"
                  required
                  value={formData.deposit_amount}
                  onChange={(e) => updateField('deposit_amount', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums"
                  placeholder="105000"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Escalation (%)</label>
                <input
                  type="number"
                  value={formData.escalation_percent}
                  onChange={(e) => updateField('escalation_percent', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums"
                  placeholder="5"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Rent-Free Period (months)</label>
                <input
                  type="number"
                  value={formData.rent_free_period}
                  onChange={(e) => updateField('rent_free_period', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-medium">Fit-Out Allowance (R)</label>
                <input
                  type="number"
                  value={formData.fitout_allowance}
                  onChange={(e) => updateField('fitout_allowance', e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] mt-1 tabular-nums"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Negotiation Notes */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--text-muted)]" /> Negotiation Notes
            </h2>
            <textarea
              value={formData.negotiation_notes}
              onChange={(e) => updateField('negotiation_notes', e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] resize-none"
              placeholder="Notes about negotiations, special terms, or tenant requests..."
            />
          </div>

          {/* Documents */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[var(--text-muted)]" /> Documents
            </h2>
            <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-secondary)] p-8 text-center">
              <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">Upload Offer to Lease</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">PDF, DOCX, or image files supported</p>
              <p className="text-xs text-[var(--text-muted)] mt-2 opacity-60">Document intelligence will auto-extract terms</p>
            </div>
          </div>

          {/* Timeline Placeholder */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--text-muted)]" /> Activity Timeline
            </h2>
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <Clock className="w-4 h-4" />
                <span className="text-sm">No activity yet. Activity will appear as this opportunity progresses.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Commercial Summary */}
        <div className="col-span-1">
          <div className="sticky top-8 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Commercial Summary</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between border-b border-[var(--border-default)] pb-2">
                <span className="text-xs text-[var(--text-muted)]">Monthly Rental</span>
                <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">{summary.rental}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-default)] pb-2">
                <span className="text-xs text-[var(--text-muted)]">Deposit</span>
                <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">{summary.deposit}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-default)] pb-2">
                <span className="text-xs text-[var(--text-muted)]">Escalation</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{summary.escalation}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-default)] pb-2">
                <span className="text-xs text-[var(--text-muted)]">Term</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{summary.term}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-default)] pb-2">
                <span className="text-xs text-[var(--text-muted)]">Expiry</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{summary.expiry}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-default)] pb-2">
                <span className="text-xs text-[var(--text-muted)]">Parking</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{summary.parking}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-default)] pb-2">
                <span className="text-xs text-[var(--text-muted)]">GLA</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{summary.gla}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--text-muted)]">Rent-Free</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{summary.rent_free}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border-default)]">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Stage 1 of 6: Offer Received</span>
              </div>
              <div className="w-full h-1 bg-[var(--bg-elevated)] rounded-full mt-2 overflow-hidden">
                <div className="w-1/6 h-full bg-emerald-400 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
