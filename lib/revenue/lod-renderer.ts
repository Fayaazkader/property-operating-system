// lib/revenue/lod-renderer.ts
// Renders LOD templates with merge fields

import { supabase } from '@/lib/supabase';

export interface LODRenderResult {
  subject: string;
  body: string;
  html: string;
}

export const lodRenderer = {
  async render(tenantId: string, templateId: string, entityId: string): Promise<LODRenderResult> {
    const { data: template } = await supabase.from('lod_templates').select('*').eq('id', templateId).single();
    if (!template) throw new Error('Template not found');

    const [tenant, lease, overdue, lastPayment, company, bankAccount] = await Promise.all([
      supabase.from('tenants').select('tenant_name, tenant_code').eq('id', tenantId).single(),
      supabase.from('leases').select('lease_id, property_name').eq('tenant_id', tenantId).eq('lease_status', 'Active').single(),
      supabase.from('sub_ledger_entries').select('running_balance, posted_at').eq('tenant_id', tenantId).eq('ledger_type', 'tenant').gt('running_balance', 0).order('posted_at', { ascending: true }).limit(1).single(),
      supabase.from('sub_ledger_entries').select('credit_amount, posted_at').eq('tenant_id', tenantId).eq('ledger_type', 'tenant').gt('credit_amount', 0).order('posted_at', { ascending: false }).limit(1).single(),
      supabase.from('organisations').select('company_name, email, telephone').eq('entity_id', entityId).single(),
      supabase.from('bank_accounts').select('bank_name, account_number, branch_code').eq('entity_id', entityId).limit(1).single(),
    ]);

    const t = tenant.data;
    const l = lease.data;
    const o = overdue.data;
    const lp = lastPayment.data;
    const c = company.data;
    const b = bankAccount.data;

    const daysOverdue = o ? Math.floor((Date.now() - new Date(o.posted_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const dueDate = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-ZA');

    const replacements: Record<string, string> = {
      '{{tenant_name}}': t?.tenant_name || '',
      '{{tenant_reference}}': t?.tenant_code || '',
      '{{lease_ref}}': l?.lease_id || '',
      '{{property_name}}': l?.property_name || '',
      '{{arrears_amount}}': (o?.running_balance || 0).toLocaleString(),
      '{{days_overdue}}': daysOverdue.toString(),
      '{{last_payment_date}}': lp?.posted_at?.split('T')[0] || '',
      '{{last_payment_amount}}': (lp?.credit_amount || 0).toLocaleString(),
      '{{statement_date}}': new Date().toLocaleDateString('en-ZA'),
      '{{company_name}}': c?.company_name || '',
      '{{company_email}}': c?.email || '',
      '{{company_phone}}': c?.telephone || '',
      '{{bank_name}}': b?.bank_name || '',
      '{{bank_account}}': b?.account_number || '',
      '{{bank_branch}}': b?.branch_code || '',
      '{{today}}': new Date().toLocaleDateString('en-ZA'),
      '{{due_date}}': dueDate,
    };

    let subject = template.subject;
    let body = template.body;

    for (const [key, value] of Object.entries(replacements)) {
      subject = subject.replace(new RegExp(key, 'g'), value);
      body = body.replace(new RegExp(key, 'g'), value);
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject}</title></head><body style="font-family:Arial,sans-serif;padding:40px;color:#1a1a1a;">${body.replace(/\n/g, '<br>')}</body></html>`;

    return { subject, body, html };
  }
};
