// lib/documents/branding/branding-service.ts
// Resolves effective branding for an entity

import { supabase } from '@/lib/supabase';
import type { BrandingConfig } from '../types';

const defaultBranding: BrandingConfig = {
  watermark_enabled: true,
  show_powered_by: true,
  primary_color: '#000000',
  accent_color: '#000000',
  font_family: 'Inter, system-ui, sans-serif',
};

export const brandingService = {
  async getBranding(entityId: string): Promise<BrandingConfig> {
    const { data } = await supabase
      .from('invoice_configs')
      .select('logo_url, company_name, company_address, company_contact, company_vat_number')
      .eq('entity_id', entityId)
      .single();

    if (!data) return defaultBranding;

    return {
      ...defaultBranding,
      logo_url: data.logo_url || undefined,
    };
  },

  async getCompanyInfo(entityId: string): Promise<{ name: string; vat_number?: string; physical_address?: string; telephone?: string; email?: string }> {
    const { data } = await supabase
      .from('invoice_configs')
      .select('company_name, company_vat_number, company_address, company_contact')
      .eq('entity_id', entityId)
      .single();

    return {
      name: data?.company_name || 'Company Name',
      vat_number: data?.company_vat_number || undefined,
      physical_address: data?.company_address || undefined,
      telephone: data?.company_contact || undefined,
      email: undefined,
    };
  }
};
