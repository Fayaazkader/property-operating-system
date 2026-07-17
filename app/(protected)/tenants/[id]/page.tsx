'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Mail, Phone, FileText, Calendar, AlertTriangle, Download, Send, Plus, FilePlus, Eye, CheckCircle, Clock } from "lucide-react";

export default function TenantWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/intelligence/tenants/${id}/workspace`);
      const json = await res.json();
      setData(json);
      setNotes(localStorage.getItem(`notes-${id}`) || "");
      setLoading(false);
    }
    load();
  }, [id]);

  const saveNotes = (val: string) => {
    setNotes(val);
    localStorage.setItem(`notes-${id}`, val);
  };

  if (loading) return <div className="p-8 text-[var(--text-muted)]">Loading...</div>;
  if (!data?.tenant) return <div className="p-8 text-[var(--text-muted)]">Tenant not found</div>;

  const { tenant, lease, allLeases, billingRules, financial, statements, aging, communications, tasks } = data;
  const formatRands = (amount: number) => `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "company", label: "Company" },
    { key: "contacts", label: "Contacts" },
    { key: "leases", label: "Leases" },
    { key: "billing", label: "Billing Rules" },
    { key: "invoices", label: "Invoices" },
    { key: "statements", label: "Statements" },
    { key: "financial", label: "Financial" },
    { key: "communications", label: "Communications" },
    { key: "documents", label: "Documents" },
    { key: "tasks", label: "Tasks" },
    { key: "notes", label: "Notes" },
    { key: "audit", label: "Audit" },
  ];

  const deliveredComms = communications?.filter((c: any) => c.status === 'delivered' || c.status === 'read').length || 0;
  const readComms = communications?.filter((c: any) => c.status === 'read').length || 0;
  const failedComms = communications?.filter((c: any) => c.status === 'failed').length || 0;
  const commsHealthy = failedComms === 0 && communications?.length > 0;

  const daysRemaining = lease?.lease_end_date ? Math.ceil((new Date(lease.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const yearsRemaining = daysRemaining ? (daysRemaining / 365).toFixed(1) : null;
  const expiringSoon = daysRemaining !== null && daysRemaining <= 180;
  const openTasks = tasks?.filter((t: any) => t.status !== 'completed').length || 0;

  const commStatusIcon = (status: string) => {
    if (status === 'read') return <Eye className="w-3 h-3 text-emerald-400" />;
    if (status === 'delivered') return <CheckCircle className="w-3 h-3 text-blue-400" />;
    if (status === 'sent') return <Send className="w-3 h-3 text-[var(--text-muted)]" />;
    if (status === 'failed') return <AlertTriangle className="w-3 h-3 text-red-400" />;
    return <Clock className="w-3 h-3 text-[var(--text-muted)]" />;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors mt-1">
          <ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
        <div className="flex-1">
          <p className="text-xs font-mono text-[var(--text-muted)]">{tenant.code || tenant.id.slice(0, 8)}</p>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{tenant.tenant_name}</h1>
          {tenant.company_registration && tenant.company_registration !== tenant.tenant_name && (
            <p className="text-sm text-[var(--text-muted)]">{tenant.company_registration}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)] flex-wrap">
            {lease && (
              <>
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {(lease as any).properties?.property_name || "—"}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {lease.lease_id}</span>
                <span>·</span>
                <span>{formatDate(lease.lease_start_date)} → {formatDate(lease.lease_end_date)}</span>
                <span>·</span>
              </>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs ${lease?.lease_status === 'Active' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>{lease?.lease_status || "No Lease"}</span>
          </div>
          <div className="flex items-center gap-6 mt-3 text-xs text-[var(--text-muted)]">
            <span>Balance: <span className={financial.balance > 0 ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>{formatRands(financial.balance)}</span></span>
            <span>Deposit: <span className="text-[var(--text-primary)]">{formatRands(financial.depositReceived)}</span></span>
            <span>Comms: {commsHealthy ? <span className="text-emerald-400">Healthy</span> : <span className="text-amber-400">{failedComms} failed</span>}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <button className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"><Download className="w-3 h-3" /> Generate Statement</button>
        <button className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"><Send className="w-3 h-3" /> Send Message</button>
        <button className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"><Plus className="w-3 h-3" /> Create Task</button>
        <button className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"><FilePlus className="w-3 h-3" /> Add Document</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className={`text-lg font-bold ${financial.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatRands(financial.balance)}</p>
          <p className="text-xs text-[var(--text-muted)]">Balance</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">{lease ? formatRands(lease.monthly_rental) : "—"}</p>
          <p className="text-xs text-[var(--text-muted)]">Monthly Billing</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className={`text-lg font-bold ${expiringSoon ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>{yearsRemaining ? `${yearsRemaining}yrs` : "—"}</p>
          <p className="text-xs text-[var(--text-muted)]">Lease Remaining</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className={`text-lg font-bold ${commsHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>{deliveredComms} del · {readComms} read</p>
          <p className="text-xs text-[var(--text-muted)]">Comms</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className={`text-lg font-bold ${openTasks > 0 ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>{openTasks} open</p>
          <p className="text-xs text-[var(--text-muted)]">Actions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-default)] overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] whitespace-nowrap ${activeTab === tab.key ? 'border-[var(--text-primary)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>{tab.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Current Lease</h3>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Property</span><span className="text-[var(--text-primary)]">{(lease as any)?.properties?.property_name || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Commencement</span><span className="text-[var(--text-primary)]">{lease ? formatDate(lease.lease_start_date) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Expiry</span><span className="text-[var(--text-primary)]">{lease ? formatDate(lease.lease_end_date) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Escalation</span><span className="text-[var(--text-primary)]">{lease?.escalation_percent ? `${lease.escalation_percent}%` : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Deposit</span><span className="text-[var(--text-primary)]">{lease?.deposit_amount ? formatRands(lease.deposit_amount) : "—"}</span></div>
                </div>

                {/* Item 4: Lease Commercial Terms */}
                {lease && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Commercial Terms</h3>
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Monthly Rental</span><span className="text-[var(--text-primary)]">{formatRands(lease.monthly_rental || 0)}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Parking</span><span className="text-[var(--text-primary)]">{lease.parking_bays || 0} bays {lease.parking_rate ? `@ ${formatRands(lease.parking_rate)}` : ""}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Escalation</span><span className="text-[var(--text-primary)]">{lease.escalation_percent || 0}%</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Billing Frequency</span><span className="text-[var(--text-primary)]">{lease.billing_frequency || "Monthly"}</span></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Financial Position</h3>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Current Charges</span><span className="text-[var(--text-primary)]">{formatRands(financial.totalCharges)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Receipts</span><span className="text-emerald-400">{formatRands(financial.totalPayments)}</span></div>
                  <div className="flex justify-between font-semibold border-t border-[var(--border-default)] pt-2"><span className="text-[var(--text-muted)]">Balance C/F</span><span className={financial.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}>{formatRands(financial.balance)}</span></div>
                </div>

                {/* Item 3: Aging Analysis */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Aging Analysis</h3>
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">Current</span><span className="text-[var(--text-primary)]">{formatRands(aging.current)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">30 Days</span><span className="text-amber-400">{formatRands(aging.days30)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">60 Days</span><span className="text-amber-400">{formatRands(aging.days60)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">90 Days</span><span className="text-red-400">{formatRands(aging.days90)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">120+ Days</span><span className="text-red-400">{formatRands(aging.days120)}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Risks */}
            {(expiringSoon || financial.balance > 10000) && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <h3 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Risks</h3>
                <div className="space-y-1 text-sm">
                  {expiringSoon && <p className="text-amber-400/80">Lease expires in {daysRemaining} days</p>}
                  {financial.balance > 10000 && <p className="text-amber-400/80">Outstanding balance exceeds R10,000</p>}
                </div>
              </div>
            )}

            {/* Item 1: Statement History */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Statement History</h3>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-default)]">
                      <th className="text-left py-2 px-4 text-xs text-[var(--text-muted)] font-normal">Period</th>
                      <th className="text-left py-2 px-4 text-xs text-[var(--text-muted)] font-normal">Sent</th>
                      <th className="text-left py-2 px-4 text-xs text-[var(--text-muted)] font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements?.slice(0, 6).map((s: any) => (
                      <tr key={s.id} className="border-b border-[var(--border-default)] last:border-0">
                        <td className="py-2 px-4 text-[var(--text-primary)]">{s.source_id?.replace("INV-", "")}</td>
                        <td className="py-2 px-4 text-[var(--text-muted)] text-xs">{formatDate(s.sent_at || s.created_at)}</td>
                        <td className="py-2 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'delivered' || s.status === 'read' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Recent Activity</h3>
              <div className="space-y-1">
                {communications?.slice(0, 8).map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 text-sm py-1.5">
                    {commStatusIcon(c.status)}
                    <span className="text-[var(--text-primary)]">{c.event_type?.replace(/_/g, " ")}</span>
                    <span className="text-xs text-[var(--text-muted)]">{formatDate(c.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Company */}
        {activeTab === "company" && (
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Registered Name</span><span className="text-[var(--text-primary)]">{tenant.company_registration || tenant.tenant_name}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Trading Name</span><span className="text-[var(--text-primary)]">{tenant.tenant_name}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">VAT Number</span><span className="text-[var(--text-primary)]">{tenant.vat_number || "—"}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Registration No</span><span className="text-[var(--text-primary)]">{tenant.company_registration || "—"}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Industry</span><span className="text-[var(--text-primary)]">{tenant.industry || "—"}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Company Type</span><span className="text-[var(--text-primary)]">{tenant.company_type || "—"}</span></div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.2em]">Delivery Preferences</p>
                <div className="flex gap-2">
                  {tenant.email_enabled && <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-300">Email</span>}
                  {tenant.whatsapp_enabled && <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300">WhatsApp</span>}
                  {tenant.sms_enabled && <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-300">SMS</span>}
                </div>
              </div>
              {/* Item 2: Deposit Ledger */}
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.2em]">Deposit Ledger</p>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Received</span><span className="text-[var(--text-primary)]">{formatRands(financial.depositReceived)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Interest</span><span className="text-[var(--text-primary)]">R0.00</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Refunded</span><span className="text-[var(--text-primary)]">R0.00</span></div>
                <div className="flex justify-between font-semibold border-t border-[var(--border-default)] pt-2"><span className="text-[var(--text-muted)]">Current Balance</span><span className="text-[var(--text-primary)]">{formatRands(financial.depositReceived)}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Contacts */}
        {activeTab === "contacts" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2">Primary</p>
              <p className="text-sm text-[var(--text-primary)]">{tenant.contact_person || "—"}</p>
              <p className="text-xs text-[var(--text-muted)]">{tenant.email}</p>
              <p className="text-xs text-[var(--text-muted)]">{tenant.phone}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2">Additional Contacts</p>
              <p className="text-sm text-[var(--text-muted)]">Accounts, Operations, Legal contacts can be added here.</p>
            </div>
          </div>
        )}

        {/* Leases — item 6: Renewals & Future */}
        {activeTab === "leases" && (
          <div className="space-y-4">
            {allLeases?.map((l: any) => (
              <div key={l.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{l.lease_id}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${l.lease_status === 'Active' ? 'bg-emerald-500/10 text-emerald-300' : l.lease_status === 'Expired' ? 'bg-red-500/10 text-red-300' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>{l.lease_status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-[var(--text-muted)]">
                  <span>Property: {l.properties?.property_name}</span>
                  <span>Rental: {formatRands(l.monthly_rental)}/mo</span>
                  <span>{formatDate(l.lease_start_date)} → {formatDate(l.lease_end_date)}</span>
                </div>
              </div>
            ))}
            {(!allLeases || allLeases.length === 0) && <p className="text-[var(--text-muted)] text-sm py-4">No leases found.</p>}
          </div>
        )}

        {/* Item 5: Billing Rules */}
        {activeTab === "billing" && (
          <div className="space-y-3">
            {billingRules?.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm py-4">No active billing rules.</p>
            ) : (
              billingRules?.map((r: any) => (
                <div key={r.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-[var(--text-primary)] font-medium">{r.description || r.rule_type}</p>
                    <p className="text-xs text-[var(--text-muted)]">{r.rule_type} · {r.frequency} · GL: {r.gl_code}</p>
                  </div>
                  <span className="text-[var(--text-primary)] font-medium tabular-nums">{formatRands(r.base_amount || 0)}</span>
                </div>
              ))
            )}
          </div>
        )}
        {/* Invoices */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">Invoice history and generation for this tenant.</p>
            <Link href={`/financials/revenue/invoices?tenant=${id}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100 transition-all">
              Generate Invoice →
            </Link>
          </div>
        )}

        {/* Statements */}
        {activeTab === "statements" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">Statement history for this tenant.</p>
            <Link href={`/financials/revenue/invoices?tenant=${id}`} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-medium text-white hover:border-white/40 transition-all">
              View Statements →
            </Link>
          </div>
        )}


        {/* Financial */}
        {activeTab === "financial" && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Balance B/F</p><p className="text-lg font-bold text-[var(--text-primary)]">R0.00</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Charges</p><p className="text-lg font-bold text-[var(--text-primary)]">{formatRands(financial.totalCharges)}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Receipts</p><p className="text-lg font-bold text-emerald-400">{formatRands(financial.totalPayments)}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Balance C/F</p><p className={`text-lg font-bold ${financial.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatRands(financial.balance)}</p></div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Recent Charges</h3>
              <div className="space-y-1">{financial.charges?.slice(0, 10).map((c: any) => (<div key={c.id} className="flex justify-between text-sm py-2 border-b border-[var(--border-default)]"><span className="text-[var(--text-primary)]">{c.description}</span><span className="text-[var(--text-primary)] tabular-nums">{formatRands(c.amount_incl_vat)}</span></div>))}</div>
            </div>
          </div>
        )}

        {/* Item 7: Communications with depth */}
        {activeTab === "communications" && (
          <div className="space-y-2">
            {communications?.map((c: any) => (
              <div key={c.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  {commStatusIcon(c.status)}
                  <div>
                    <p className="text-[var(--text-primary)]">{c.event_type?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-[var(--text-muted)]">{c.channel} · {formatDate(c.created_at)}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'delivered' || c.status === 'read' ? 'bg-emerald-500/10 text-emerald-300' : c.status === 'failed' ? 'bg-red-500/10 text-red-300' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Documents */}
        {activeTab === "documents" && (
          <div className="grid grid-cols-3 gap-4">
            {["FICA", "Lease Agreement", "Addendums", "Insurance", "Resolutions", "Correspondence"].map(cat => (
              <div key={cat} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center">
                <FileText className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-xs text-[var(--text-primary)]">{cat}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">No documents</p>
              </div>
            ))}
          </div>
        )}

        {/* Tasks */}
        {activeTab === "tasks" && (
          <div className="space-y-2">
            {tasks?.length === 0 ? <p className="text-[var(--text-muted)] text-sm py-4">No tasks.</p> : tasks?.map((t: any) => (
              <div key={t.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-sm flex items-center justify-between">
                <div><p className="text-[var(--text-primary)]">{t.title || t.description || "Task"}</p><p className="text-xs text-[var(--text-muted)]">{t.assigned_to ? `Assigned: ${t.assigned_to}` : ""} · Due: {t.due_date || "—"} · {t.priority || ""}</p></div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{t.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Item 9: Internal Notes */}
        {activeTab === "notes" && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">Internal notes for this tenant. Not visible to the tenant.</p>
            <textarea
              value={notes}
              onChange={(e) => saveNotes(e.target.value)}
              placeholder="Add notes about this tenant... (payment arrangements, contact preferences, internal flags)"
              rows={8}
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] resize-none placeholder:text-[var(--text-muted)]"
            />
            <p className="text-xs text-[var(--text-muted)]">Notes are saved automatically to this browser.</p>
          </div>
        )}

        {/* Item 8: Audit Trail */}
        {activeTab === "audit" && (
          <div className="space-y-1">
            {communications?.slice(0, 20).map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 text-sm py-1.5">
                {commStatusIcon(c.status)}
                <span className="text-[var(--text-primary)]">{c.event_type?.replace(/_/g, " ")}</span>
                <span className="text-xs text-[var(--text-muted)]">{formatDate(c.created_at)}</span>
                <span className="text-xs text-[var(--text-muted)]">{c.channel}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
