// lib/brokerage/brokers/broker.types.ts
// Broker Type Definitions

import { BrokerStatusType, CommissionTypeType } from "@/lib/platform/types";

export interface Broker {
  id: string;
  entity_id?: string;
  company_id?: string;
  name: string;
  email?: string;
  phone?: string;
  employee_number?: string;
  commission_rate?: number;
  commission_type?: CommissionTypeType;
  status: BrokerStatusType;
  fica_verified: boolean;
  fica_verified_at?: string;
  profile_photo_url?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateBrokerParams {
  name: string;
  company_id?: string;
  email?: string;
  phone?: string;
  employee_number?: string;
  commission_rate?: number;
  commission_type?: CommissionTypeType;
}

export interface UpdateBrokerParams {
  name?: string;
  company_id?: string;
  email?: string;
  phone?: string;
  employee_number?: string;
  commission_rate?: number;
  commission_type?: CommissionTypeType;
  status?: BrokerStatusType;
}
