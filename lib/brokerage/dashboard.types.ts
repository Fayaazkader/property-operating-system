// lib/brokerage/dashboard.types.ts
// Brokerage Dashboard Types

export interface Vacancy {
  id: string;
  status: string;
  created_at: string;
}

export interface Broker {
  id: string;
  name: string;
  fica_verified: boolean;
  status: string;
}

export interface Mandate {
  id: string;
  broker_id: string;
  status: string;
  expiry_date: string | null;
}

export interface Commission {
  id: string;
  broker_id: string;
  status: string;
  total_commission: number;
  created_at: string;
}

export interface Offer {
  id: string;
  status: string;
  created_at: string;
  vacancy_id: string;
  offer_date: string;
}

export interface Viewing {
  id: string;
  viewing_date: string;
  status: string;
  enquiry_id: string;
  vacancy_id: string;
}

export interface DashboardStats {
  vacancies: {
    total: number;
    active: number;
    marketing: number;
    under_offer: number;
  };
  brokers: {
    total: number;
    active: number;
    fica_missing: number;
  };
  commissions: {
    pending: number;
    pending_value: number;
    approved: number;
    paid: number;
  };
  mandates: {
    active: number;
    expiring: number;
  };
  offers: {
    waiting: number;
    total: number;
  };
  viewings: {
    today: number;
    total: number;
  };
  risk: {
    expiring_mandates: number;
    offers_waiting: number;
    fica_missing: number;
    total_risk: number;
  };
}

export interface AttentionItem {
  id: string;
  type: 'mandate_expiring' | 'offer_waiting' | 'commission_approval' | 'fica_missing';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  date: string;
  href: string;
}

export interface TodayItem {
  id: string;
  type: 'viewing' | 'deadline' | 'task';
  title: string;
  time: string;
  href: string;
}
