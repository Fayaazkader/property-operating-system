'use client';

import { useState, useEffect } from 'react';
import { Search, Eye, CheckCircle, AlertTriangle, Clock, Phone, Mail, MessageSquare } from "lucide-react";

export default function CommunicationsPage() {
  const [data, setData] = useState<any>({ communications: [], total: 0, summary: null });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => { loadData(); }, [page, channelFilter, statusFilter, searchTerm]);

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), channel: channelFilter, status: statusFilter });
    if (searchTerm) params.set("search", searchTerm);
    const res = await fetch(`/api/intelligence/communications?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  const { communications, total, summary } = data;
  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const statusIcon = (status: string) => {
    if (status === 'read') return <Eye className="w-4 h-4 text-emerald-400" />;
    if (status === 'delivered') return <CheckCircle className="w-4 h-4 text-blue-400" />;
    if (status === 'failed') return <AlertTriangle className="w-4 h-4 text-red-400" />;
    if (status === 'sent') return <Clock className="w-4 h-4 text-amber-400" />;
    return <Clock className="w-4 h-4 text-[var(--text-muted)]" />;
  };

  const channelIcon = (channel: string) => {
    if (channel === 'whatsapp') return <Phone className="w-4 h-4 text-emerald-400" />;
    if (channel === 'email') return <Mail className="w-4 h-4 text-blue-400" />;
    return <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Communications</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">{total} messages · Showing {Math.min((page * pageSize) + 1, total)}-{Math.min((page + 1) * pageSize, total)} of {total}</p>
      </div>

      {/* KPIs */}
      {summary && (
        <>
          <div className="grid grid-cols-6 gap-3">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{summary.total}</p><p className="text-xs text-[var(--text-muted)]">Total</p></div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-emerald-400">{summary.deliveryRate}%</p><p className="text-xs text-[var(--text-muted)]">Delivered</p></div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-blue-400">{summary.readRate}%</p><p className="text-xs text-[var(--text-muted)]">Read Rate</p></div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className={`text-lg font-bold ${summary.failed > 0 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>{summary.failed}</p><p className="text-xs text-[var(--text-muted)]">Failed</p></div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-amber-400">{summary.pending}</p><p className="text-xs text-[var(--text-muted)]">Pending</p></div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{summary.read}</p><p className="text-xs text-[var(--text-muted)]">Read</p></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><Phone className="w-3 h-3 text-emerald-400" /> WhatsApp</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Total</span><span className="text-[var(--text-primary)]">{summary.whatsapp.total}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Delivered</span><span className="text-emerald-400">{summary.whatsapp.delivered}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Read</span><span className="text-blue-400">{summary.whatsapp.read}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Failed</span><span className="text-red-400">{summary.whatsapp.failed}</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><Mail className="w-3 h-3 text-blue-400" /> Email</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Total</span><span className="text-[var(--text-primary)]">{summary.email.total}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Delivered</span><span className="text-emerald-400">{summary.email.delivered}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Read</span><span className="text-blue-400">{summary.email.read}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Failed</span><span className="text-red-400">{summary.email.failed}</span></div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Attention Queue */}
      {summary && (summary.failed > 0 || summary.pending > 0) && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs text-amber-300 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> Attention Queue</p>
          <div className="space-y-1 text-sm">
            {summary.failed > 0 && <p className="text-amber-400/80">{summary.failed} failed messages require investigation</p>}
            {summary.pending > 0 && <p className="text-amber-400/80">{summary.pending} messages pending delivery</p>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }} placeholder="Search by message, event, or reference..." className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)]" />
        </div>
        <div className="flex gap-2">
          {["all", "whatsapp", "email"].map(f => (
            <button key={f} onClick={() => { setChannelFilter(f); setPage(0); }} className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${channelFilter === f ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'}`}>{f === "all" ? "All Channels" : f === "whatsapp" ? "WhatsApp" : "Email"}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {["all", "delivered", "read", "sent", "failed"].map(f => (
            <button key={f} onClick={() => { setStatusFilter(f); setPage(0); }} className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${statusFilter === f ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => (<div key={i} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 animate-pulse"><div className="h-4 bg-[var(--bg-elevated)] rounded w-1/3 mb-2"></div><div className="h-3 bg-[var(--bg-elevated)] rounded w-1/2"></div></div>))}</div>
      ) : communications.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">No messages found</div>
      ) : (
        <>
          <div className="space-y-2">
            {communications.map((c: any) => (
              <div key={c.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  {channelIcon(c.channel)}
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate">{c.event_type?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{c.message_body?.slice(0, 100)}{(c.message_body?.length || 0) > 100 ? '...' : ''}</p>
                    <p className="text-xs text-[var(--text-muted)]">{c.source_id} · {formatDate(c.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-xs text-[var(--text-muted)] hidden md:inline">{c.channel}</span>
                  {statusIcon(c.status)}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>Showing {Math.min((page * pageSize) + 1, total)}-{Math.min((page + 1) * pageSize, total)} of {total}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-elevated)] disabled:opacity-30">← Prev</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const pageNum = start + i;
                  return (
                    <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === pageNum ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}>{pageNum + 1}</button>
                  );
                })}
                {totalPages > 5 && page < totalPages - 3 && <span className="text-xs text-[var(--text-muted)]">...{totalPages}</span>}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-elevated)] disabled:opacity-30">Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
