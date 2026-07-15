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
} from "lucide-react";
import {
  Vacancy,
  Broker,
  Mandate,
  Commission,
  Offer,
  Viewing,
  DashboardStats,
  AttentionItem,
  TodayItem,
} from "@/lib/brokerage/dashboard.types";

export default function BrokerageOperations() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    vacancies: { total: 0, active: 0, marketing: 0, under_offer: 0 },
    brokers: { total: 0, active: 0, fica_missing: 0 },
    commissions: { pending: 0, pending_value: 0, approved: 0, paid: 0 },
    mandates: { active: 0, expiring: 0 },
    offers: { waiting: 0, total: 0 },
    viewings: { today: 0, total: 0 },
    risk: { expiring_mandates: 0, offers_waiting: 0, fica_missing: 0, total_risk: 0 },
  });
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [todayItems, setTodayItems] = useState<TodayItem[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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

      const [
        vacanciesRes,
        brokersRes,
        mandatesRes,
        commissionsRes,
        offersRes,
        viewingsRes,
      ] = await Promise.all([
        supabase.from('vacancies').select('id, status, created_at').eq('entity_id', entityId),
        supabase.from('brokers').select('id, name, fica_verified, status').eq('entity_id', entityId),
        supabase.from('broker_mandates').select('id, broker_id, status, expiry_date').eq('entity_id', entityId),
        supabase.from('broker_commissions').select('id, broker_id, status, total_commission, created_at').eq('entity_id', entityId),
        supabase.from('offers').select('id, status, created_at, vacancy_id, offer_date').eq('entity_id', entityId),
        supabase.from('viewings').select('id, viewing_date, status, enquiry_id, vacancy_id').eq('entity_id', entityId),
      ]);

      const vacancies = (vacanciesRes.data || []) as Vacancy[];
      const brokers = (brokersRes.data || []) as Broker[];
      const mandates = (mandatesRes.data || []) as Mandate[];
      const commissions = (commissionsRes.data || []) as Commission[];
      const offers = (offersRes.data || []) as Offer[];
      const viewings = (viewingsRes.data || []) as Viewing[];

      // --- STATS ---
      const activeVacancies = vacancies.filter((v: Vacancy) => v.status === 'active').length;
      const marketingVacancies = vacancies.filter((v: Vacancy) => v.status === 'marketing').length;
      const underOfferVacancies = vacancies.filter((v: Vacancy) => v.status === 'under_offer').length;

      const activeBrokers = brokers.filter((b: Broker) => b.status === 'active').length;
      const ficaMissing = brokers.filter((b: Broker) => b.status === 'active' && !b.fica_verified).length;

      const pendingCommissions = commissions.filter((c: Commission) => c.status === 'pending_approval').length;
      const pendingValue = commissions.filter((c: Commission) => c.status === 'pending_approval')
        .reduce((sum: number, c: Commission) => sum + (c.total_commission || 0), 0);
      const approvedCommissions = commissions.filter((c: Commission) => c.status === 'approved').length;
      const paidCommissions = commissions.filter((c: Commission) => c.status === 'payment_requested').length;

      const activeMandates = mandates.filter((m: Mandate) => m.status === 'accepted').length;
      const expiringMandates = mandates.filter((m: Mandate) => {
        if (!m.expiry_date) return false;
        const expiry = new Date(m.expiry_date);
        const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 7;
      }).length;

      const totalOffers = offers.length;
      const waitingOffers = offers.filter((o: Offer) => {
        const created = new Date(o.created_at);
        const diff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return o.status === 'received' && diff > 3;
      }).length;

      const totalViewings = viewings.length;
      const todayViewings = viewings.filter((v: Viewing) => v.viewing_date?.startsWith(todayStr)).length;

      setStats({
        vacancies: {
          total: vacancies.length,
          active: activeVacancies,
          marketing: marketingVacancies,
          under_offer: underOfferVacancies,
        },
        brokers: {
          total: brokers.length,
          active: activeBrokers,
          fica_missing: ficaMissing,
        },
        commissions: {
          pending: pendingCommissions,
          pending_value: pendingValue,
          approved: approvedCommissions,
          paid: paidCommissions,
        },
        mandates: {
          active: activeMandates,
          expiring: expiringMandates,
        },
        offers: {
          waiting: waitingOffers,
          total: totalOffers,
        },
        viewings: {
          today: todayViewings,
          total: totalViewings,
        },
        risk: {
          expiring_mandates: expiringMandates,
          offers_waiting: waitingOffers,
          fica_missing: ficaMissing,
          total_risk: expiringMandates + waitingOffers + ficaMissing,
        },
      });

      // --- ATTENTION ITEMS ---
      const attention: AttentionItem[] = [];

      const expiring = mandates.filter((m: Mandate) => {
        if (!m.expiry_date) return false;
        const expiry = new Date(m.expiry_date);
        const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 7;
      });

      for (const m of expiring.slice(0, 3)) {
        const broker = brokers.find((b: Broker) => b.id === m.broker_id);
        attention.push({
          id: m.id,
          type: 'mandate_expiring',
          title: `Mandate expiring${broker ? ` for ${broker.name}` : ''}`,
          description: `Expires ${new Date(m.expiry_date!).toLocaleDateString()}`,
          severity: 'high',
          date: m.expiry_date!,
          href: `/brokerage/mandates/${m.id}`,
        });
      }

      const waiting = offers.filter((o: Offer) => {
        const created = new Date(o.created_at);
        const diff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return o.status === 'received' && diff > 3;
      });

      for (const o of waiting.slice(0, 2)) {
        attention.push({
          id: o.id,
          type: 'offer_waiting',
          title: `Offer awaiting response`,
          description: `Received ${new Date(o.created_at).toLocaleDateString()}`,
          severity: 'medium',
          date: o.created_at,
          href: `/brokerage/offers/${o.id}`,
        });
      }

      const pending = commissions.filter((c: Commission) => c.status === 'pending_approval');
      for (const c of pending.slice(0, 2)) {
        const broker = brokers.find((b: Broker) => b.id === c.broker_id);
        attention.push({
          id: c.id,
          type: 'commission_approval',
          title: `Commission approval needed${broker ? ` for ${broker.name}` : ''}`,
          description: `R${c.total_commission?.toLocaleString() || 0}`,
          severity: 'high',
          date: c.created_at,
          href: `/brokerage/commissions/${c.id}`,
        });
      }

      const missingFica = brokers.filter((b: Broker) => b.status === 'active' && !b.fica_verified);
      for (const b of missingFica.slice(0, 2)) {
        attention.push({
          id: b.id,
          type: 'fica_missing',
          title: `FICA verification required for ${b.name}`,
          description: 'Required for commission payments',
          severity: 'medium',
          date: new Date().toISOString(),
          href: `/brokerage/brokers/${b.id}`,
        });
      }

      setAttentionItems(attention.slice(0, 8));

      // --- TODAY ITEMS ---
      const today: TodayItem[] = [];
      const todayViewingsList = viewings.filter((v: Viewing) => v.viewing_date?.startsWith(todayStr));

      for (const v of todayViewingsList.slice(0, 5)) {
        today.push({
          id: v.id,
          type: 'viewing',
          title: `Viewing scheduled`,
          time: new Date(v.viewing_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          href: `/brokerage/viewings/${v.id}`,
        });
      }

      setTodayItems(today);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Brokerage Operations</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Manage vacancies, brokers, offers, and commissions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/brokerage/vacancies/new')}
            className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New Vacancy
          </button>
          <button
            onClick={() => router.push('/brokerage/brokers/new')}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Broker
          </button>
        </div>
      </div>

      {attentionItems.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Needs Attention
          </h2>
          <div className="grid gap-2">
            {attentionItems.map((item) => (
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
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Active Vacancies</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stats.vacancies.active}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Building className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {stats.vacancies.marketing} marketing · {stats.vacancies.under_offer} under offer
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Active Brokers</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stats.brokers.active}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {stats.mandates.active} active mandates · {stats.brokers.fica_missing} need FICA
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Pending Commissions</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stats.commissions.pending}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Value: {formatCurrency(stats.commissions.pending_value)}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Risk</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stats.risk.total_risk}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {stats.risk.expiring_mandates} expiring · {stats.risk.offers_waiting} offers waiting
          </p>
        </div>
      </div>

      {todayItems.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
            Today
          </h2>
          <div className="grid gap-2">
            {todayItems.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)] transition-colors text-left w-full"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)]">{item.title}</p>
                </div>
                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{item.time}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => router.push('/brokerage/vacancies')}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center hover:border-[var(--border-hover)] transition-colors"
        >
          <Building className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-xs text-[var(--text-secondary)]">Vacancies</p>
        </button>
        <button
          onClick={() => router.push('/brokerage/brokers')}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center hover:border-[var(--border-hover)] transition-colors"
        >
          <Users className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-xs text-[var(--text-secondary)]">Brokers</p>
        </button>
        <button
          onClick={() => router.push('/brokerage/offers')}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center hover:border-[var(--border-hover)] transition-colors"
        >
          <Briefcase className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-xs text-[var(--text-secondary)]">Offers</p>
        </button>
        <button
          onClick={() => router.push('/brokerage/commissions')}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center hover:border-[var(--border-hover)] transition-colors"
        >
          <DollarSign className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1" />
          <p className="text-xs text-[var(--text-secondary)]">Commissions</p>
        </button>
      </div>
    </div>
  );
}