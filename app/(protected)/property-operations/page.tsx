'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import {
  Building2,
  Users,
  FileText,
  Calendar,
  DollarSign,
  TrendingUp,
  Briefcase,
  UserPlus,
  Plus,
  Clock,
  AlertCircle,
  Building,
  User,
  CheckCircle,
  XCircle,
  Wrench,
  ClipboardList,
  Truck,
  Shield,
  Bell,
  Settings,
  Search,
  Filter,
  MoreVertical,
  ArrowUpRight,
  Sun,
  LayoutGrid,
  List,
  CheckSquare,
  Clock as ClockIcon,
  ExternalLink,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface MorningBrief {
  greeting: string;
  summary: string;
  date: string;
}

interface OperationalQueue {
  id: string;
  name: string;
  count: number;
  items: any[];
  href: string;
}

interface AttentionItem {
  id: string;
  type: 'sla_breach' | 'compliance_expiring' | 'high_priority' | 'supplier_insurance' | 'inspection_overdue' | 'approval_required';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  date: string;
  href: string;
  action?: string;
}

interface ApprovalItem {
  id: string;
  type: string;
  title: string;
  requested_by: string;
  requested_at: string;
  amount?: number;
  href: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  action: string;
  href: string;
}

interface KPI {
  label: string;
  value: number;
  change?: number;
  icon: any;
  color: string;
}

interface WorkspaceData {
  morningBrief: MorningBrief;
  kpis: KPI[];
  queues: OperationalQueue[];
  attention: AttentionItem[];
  approvals: ApprovalItem[];
  recommendations: Recommendation[];
  recentActivity: any[];
}

export default function PropertyOperationsWorkspace() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WorkspaceData>({
    morningBrief: { greeting: '', summary: '', date: '' },
    kpis: [],
    queues: [],
    attention: [],
    approvals: [],
    recommendations: [],
    recentActivity: [],
  });

  useEffect(() => {
    loadWorkspace();
  }, []);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('entity_id')
        .eq('id', user.id)
        .single();

      if (!profile?.entity_id) { setLoading(false); return; }

      const entityId = profile.entity_id;

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Load all data
      const [
        assetsRes,
        workOrdersRes,
        inspectionsRes,
        suppliersRes,
        complianceRes,
        approvalsRes,
      ] = await Promise.all([
        supabase.from('assets').select('id, status').eq('entity_id', entityId),
        supabase.from('work_orders').select('*').eq('entity_id', entityId),
        supabase.from('inspections').select('*').eq('entity_id', entityId),
        supabase.from('suppliers').select('*').eq('entity_id', entityId),
        supabase.from('compliance_items').select('*').eq('entity_id', entityId),
        supabase.from('approval_requests').select('*').eq('entity_id', entityId).eq('status', 'pending'),
      ]);

      const assets = assetsRes.data || [];
      const workOrders = workOrdersRes.data || [];
      const inspections = inspectionsRes.data || [];
      const suppliers = suppliersRes.data || [];
      const compliance = complianceRes.data || [];
      const approvals = approvalsRes.data || [];

      // --- KPIs ---
      const kpis: KPI[] = [
        {
          label: 'Open Work Orders',
          value: workOrders.filter((w: any) => !['completed', 'closed', 'cancelled'].includes(w.status || '')).length,
          icon: Wrench,
          color: 'text-blue-400',
        },
        {
          label: 'Active Assets',
          value: assets.filter((a: any) => a.status === 'active').length,
          icon: Building,
          color: 'text-emerald-400',
        },
        {
          label: 'SLA Breached',
          value: workOrders.filter((w: any) => w.sla_breached === true && w.status !== 'completed').length,
          icon: AlertCircle,
          color: 'text-red-400',
        },
        {
          label: 'Compliance Risk',
          value: compliance.filter((c: any) => c.status === 'expiring' || c.status === 'expired').length,
          icon: Shield,
          color: 'text-amber-400',
        },
      ];

      // --- Operational Queues ---
      const queues: OperationalQueue[] = [
        {
          id: 'queue.assignment',
          name: 'Needs Assignment',
          count: workOrders.filter((w: any) => w.status === 'reported' || w.status === 'triaged').length,
          items: workOrders.filter((w: any) => w.status === 'reported' || w.status === 'triaged').slice(0, 3),
          href: '/property-operations/work-orders?filter=unassigned',
        },
        {
          id: 'queue.supplier',
          name: 'Waiting Supplier',
          count: workOrders.filter((w: any) => w.status === 'assigned' || w.status === 'accepted').length,
          items: workOrders.filter((w: any) => w.status === 'assigned' || w.status === 'accepted').slice(0, 3),
          href: '/property-operations/work-orders?filter=assigned',
        },
        {
          id: 'queue.approval',
          name: 'Waiting Approval',
          count: workOrders.filter((w: any) => w.status === 'approved' || w.status === 'quoted').length + approvals.length,
          items: [...workOrders.filter((w: any) => w.status === 'approved' || w.status === 'quoted'), ...approvals].slice(0, 3),
          href: '/property-operations/approvals',
        },
        {
          id: 'queue.completion',
          name: 'Ready to Complete',
          count: workOrders.filter((w: any) => w.status === 'completed' && !w.completed_at?.startsWith(todayStr)).length,
          items: workOrders.filter((w: any) => w.status === 'completed' && !w.completed_at?.startsWith(todayStr)).slice(0, 3),
          href: '/property-operations/work-orders?filter=completed',
        },
      ];

      // --- Attention Items ---
      const attention: AttentionItem[] = [];

      const breached = workOrders.filter((w: any) => w.sla_breached === true && w.status !== 'completed');
      for (const w of breached.slice(0, 3)) {
        attention.push({
          id: w.id,
          type: 'sla_breach',
          title: `SLA Breach: ${w.title || 'Work Order'}`,
          description: 'Response time exceeded SLA — action required',
          severity: 'high',
          date: w.created_at || new Date().toISOString(),
          href: `/property-operations/work-orders/${w.id}`,
          action: 'Assign Now',
        });
      }

      const expiring = compliance.filter((c: any) => c.status === 'expiring');
      for (const c of expiring.slice(0, 3)) {
        attention.push({
          id: c.id,
          type: 'compliance_expiring',
          title: `Compliance Expiring: ${c.name || 'Item'}`,
          description: `Expires in 30 days — renew now`,
          severity: 'medium',
          date: c.expiry_date || new Date().toISOString(),
          href: `/property-operations/compliance/${c.id}`,
          action: 'Renew',
        });
      }

      const highPriority = workOrders.filter((w: any) => 
        (w.priority === 'high' || w.priority === 'emergency') && 
        !['completed', 'closed', 'cancelled'].includes(w.status || '')
      );
      for (const w of highPriority.slice(0, 2)) {
        attention.push({
          id: w.id,
          type: 'high_priority',
          title: `High Priority: ${w.title || 'Work Order'}`,
          description: `Priority: ${w.priority} — immediate attention required`,
          severity: 'high',
          date: w.created_at || new Date().toISOString(),
          href: `/property-operations/work-orders/${w.id}`,
          action: 'View',
        });
      }

      const unverified = suppliers.filter((s: any) => (!s.insurance_verified || !s.fica_verified) && s.status === 'active');
      for (const s of unverified.slice(0, 2)) {
        attention.push({
          id: s.id,
          type: 'supplier_insurance',
          title: `Supplier Verification Required: ${s.name}`,
          description: 'Insurance and FICA verification required before payment',
          severity: 'medium',
          date: new Date().toISOString(),
          href: `/property-operations/suppliers/${s.id}`,
          action: 'Verify',
        });
      }

      // --- Approvals ---
      const approvalItems: ApprovalItem[] = approvals.slice(0, 5).map((a: any) => ({
        id: a.id,
        type: a.entity_type || 'unknown',
        title: `${a.action || 'Action'} requested for ${a.entity_type || 'item'}`,
        requested_by: a.requested_by || 'Unknown',
        requested_at: a.requested_at || new Date().toISOString(),
        amount: a.metadata?.amount,
        href: `/property-operations/approvals/${a.id}`,
      }));

      // --- Recommendations ---
      const recommendations: Recommendation[] = [];

      const unassignedHigh = workOrders.filter((w: any) => 
        (!w.assigned_to) && (w.priority === 'high' || w.priority === 'emergency') && 
        !['completed', 'closed', 'cancelled'].includes(w.status || '')
      );
      if (unassignedHigh.length > 0) {
        recommendations.push({
          id: 'rec.1',
          title: 'Assign High Priority Work Orders',
          description: `${unassignedHigh.length} high priority work orders need supplier assignment`,
          action: 'Assign Now',
          href: '/property-operations/work-orders?filter=unassigned&priority=high',
        });
      }

      if (expiring.length > 0) {
        recommendations.push({
          id: 'rec.2',
          title: 'Renew Expiring Compliance Items',
          description: `${expiring.length} compliance items expiring within 30 days`,
          action: 'Review',
          href: '/property-operations/compliance?filter=expiring',
        });
      }

      const pendingPOs = approvals.filter((a: any) => a.entity_type === 'purchase_order');
      if (pendingPOs.length > 0) {
        recommendations.push({
          id: 'rec.3',
          title: 'Approve Pending Purchase Orders',
          description: `${pendingPOs.length} purchase orders awaiting approval`,
          action: 'Approve',
          href: '/property-operations/approvals?type=purchase_order',
        });
      }

      // --- Morning Brief ---
      const hour = now.getHours();
      let greeting = 'Good Morning';
      if (hour >= 12) greeting = 'Good Afternoon';
      if (hour >= 18) greeting = 'Good Evening';

      const openCount = workOrders.filter((w: any) => !['completed', 'closed', 'cancelled'].includes(w.status || '')).length;
      const todayInspections = inspections.filter((i: any) => i.scheduled_date === todayStr).length;

      const brief: MorningBrief = {
        greeting: `${greeting}, ${user.email?.split('@')[0] || 'Property Manager'}`,
        summary: `${openCount} work orders open · ${todayInspections} inspections today · ${queues[0]?.count || 0} need assignment`,
        date: now.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }),
      };

      // --- Recent Activity ---
      const recent: any[] = [];

      const recentWO = (workOrders || []).slice(0, 3);
      for (const w of recentWO) {
        const dateValue = w.created_at || w.updated_at || new Date().toISOString();
        recent.push({
          id: w.id,
          type: 'work_order',
          title: w.title || 'Work Order',
          status: w.status || 'pending',
          date: dateValue,
          href: `/property-operations/work-orders/${w.id}`,
          icon: Wrench,
        });
      }

      const recentInsp = (inspections || []).slice(0, 2);
      for (const i of recentInsp) {
        const dateValue = i.created_at || i.scheduled_date || i.updated_at || new Date().toISOString();
        recent.push({
          id: i.id,
          type: 'inspection',
          title: i.title || 'Inspection',
          status: i.status || 'scheduled',
          date: dateValue,
          href: `/property-operations/inspections/${i.id}`,
          icon: ClipboardList,
        });
      }

      recent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setData({
        morningBrief: brief,
        kpis,
        queues,
        attention: attention.slice(0, 8),
        approvals: approvalItems,
        recommendations,
        recentActivity: recent.slice(0, 10),
      });

    } catch (error) {
      console.error('Error loading workspace:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-blue-500/10 text-blue-400',
      open: 'bg-blue-500/10 text-blue-400',
      reported: 'bg-yellow-500/10 text-yellow-400',
      triaged: 'bg-blue-500/10 text-blue-400',
      assigned: 'bg-purple-500/10 text-purple-400',
      accepted: 'bg-purple-500/10 text-purple-400',
      in_progress: 'bg-amber-500/10 text-amber-400',
      completed: 'bg-emerald-500/10 text-emerald-400',
      verified: 'bg-emerald-500/20 text-emerald-400',
      closed: 'bg-emerald-500/20 text-emerald-400',
      scheduled: 'bg-blue-500/10 text-blue-400',
      expiring: 'bg-yellow-500/10 text-yellow-400',
      expired: 'bg-red-500/10 text-red-400',
      pending: 'bg-yellow-500/10 text-yellow-400',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-400';
  };

  const getSeverityBg = (severity: string) => {
    return severity === 'high' ? 'bg-red-500/10' : severity === 'medium' ? 'bg-amber-500/10' : 'bg-blue-500/10';
  };

  const getSeverityColor = (severity: string) => {
    return severity === 'high' ? 'text-red-400' : severity === 'medium' ? 'text-amber-400' : 'text-blue-400';
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 pt-8 pb-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[var(--bg-elevated)] rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-[var(--bg-elevated)] rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-[var(--bg-elevated)] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 pt-8 pb-12">
      {/* Morning Brief */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Sun className="w-5 h-5 text-amber-400" />
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{data.morningBrief.date}</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-1">{data.morningBrief.greeting}</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">{data.morningBrief.summary}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/property-operations/search')}
              className="p-2 rounded-xl border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-colors"
            >
              <Search className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
            <button
              onClick={() => router.push('/property-operations/work-orders/new')}
              className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              New Work Order
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {data.kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div key={index} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">{kpi.label}</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{kpi.value}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Operational Queues */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        {data.queues.map((queue) => (
          <button
            key={queue.id}
            onClick={() => router.push(queue.href)}
            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-left hover:border-[var(--border-hover)] transition-colors"
          >
            <p className="text-xs text-[var(--text-muted)]">{queue.name}</p>
            <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{queue.count}</p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {queue.items.length > 0 ? `${queue.items.length} items need attention` : 'All clear'}
            </p>
          </button>
        ))}
      </div>

      {/* Needs Attention */}
      {data.attention.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Needs Attention
          </h2>
          <div className="grid gap-2">
            {data.attention.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={`flex items-center gap-3 p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)] transition-colors text-left w-full`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getSeverityBg(item.severity)}`}>
                  <AlertCircle className={`w-4 h-4 ${getSeverityColor(item.severity)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)]">{item.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{item.description}</p>
                </div>
                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {new Date(item.date).toLocaleDateString()}
                </span>
                {item.action && (
                  <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    {item.action}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Approvals */}
      {data.approvals.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400" />
            Approvals Waiting
          </h2>
          <div className="grid gap-2">
            {data.approvals.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)] transition-colors text-left w-full"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)]">{item.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Requested by {item.requested_by} · {new Date(item.requested_at).toLocaleDateString()}
                  </p>
                </div>
                {item.amount && (
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">{formatCurrency(item.amount)}</span>
                )}
                <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  Review
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Recommendations
          </h2>
          <div className="grid gap-2">
            {data.recommendations.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 transition-colors text-left w-full"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)]">{item.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{item.description}</p>
                </div>
                <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {item.action}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</h2>
          <button
            onClick={() => router.push('/property-operations/activity')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            View all
          </button>
        </div>
        <div className="divide-y divide-[var(--border-default)]">
          {data.recentActivity.length === 0 ? (
            <div className="px-6 py-8 text-center text-[var(--text-muted)] text-sm">
              No recent activity
            </div>
          ) : (
            data.recentActivity.map((activity) => {
              const Icon = activity.icon || FileText;
              return (
                <button
                  key={activity.id}
                  onClick={() => router.push(activity.href)}
                  className="w-full px-6 py-3 flex items-center gap-4 hover:bg-[var(--bg-elevated)] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">{activity.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{new Date(activity.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(activity.status)}`}>
                    {activity.status.replace('_', ' ')}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => router.push('/property-operations/assets')}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center hover:border-[var(--border-hover)] transition-colors"
        >
          <Building className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-xs text-[var(--text-secondary)]">Assets</p>
        </button>
        <button
          onClick={() => router.push('/property-operations/work-orders')}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center hover:border-[var(--border-hover)] transition-colors"
        >
          <Wrench className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-xs text-[var(--text-secondary)]">Work Orders</p>
        </button>
        <button
          onClick={() => router.push('/property-operations/inspections')}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center hover:border-[var(--border-hover)] transition-colors"
        >
          <ClipboardList className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-xs text-[var(--text-secondary)]">Inspections</p>
        </button>
        <button
          onClick={() => router.push('/property-operations/suppliers')}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center hover:border-[var(--border-hover)] transition-colors"
        >
          <Truck className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-xs text-[var(--text-secondary)]">Suppliers</p>
        </button>
      </div>
    </div>
  );
}