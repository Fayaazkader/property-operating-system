// lib/communications/template-engine.ts
// Template Engine — DB-first with code fallbacks

import { supabase } from '@/lib/supabase';

const fallbackTemplates: Record<string, { subject?: string; body: string }> = {
  statement_ready_email: {
    subject: 'Your Statement — {{tenant_name}}',
    body: 'Dear {{tenant_name}},\n\nYour statement for {{period}} is now available.\n\nAmount Due: {{amount}}\n\nView your statement: {{link}}',
  },
  statement_ready_whatsapp: {
    body: '📄 Your statement for {{period}} is ready.\nAmount Due: {{amount}}\nView: {{link}}',
  },
  invoice_ready_email: {
    subject: 'Invoice {{invoice_number}} — {{tenant_name}}',
    body: 'Dear {{tenant_name}},\n\nYour invoice {{invoice_number}} is ready.\n\nAmount: {{amount}}\nDue Date: {{due_date}}\n\nView invoice: {{link}}',
  },
  invoice_ready_whatsapp: {
    body: '🧾 Invoice {{invoice_number}}\nAmount: {{amount}}\nDue: {{due_date}}\nView: {{link}}',
  },
  receipt_email: {
    subject: 'Payment Received — {{tenant_name}}',
    body: 'Dear {{tenant_name}},\n\nWe have received your payment of {{amount}}.\n\nReference: {{reference}}\nDate: {{date}}',
  },
  receipt_whatsapp: {
    body: '✅ Payment received: {{amount}}\nReference: {{reference}}\nThank you!',
  },
};

function render(template: string, data: Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(data)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return rendered;
}

export async function getTemplateBody(entityId: string, templateId: string, data: Record<string, string>): Promise<string> {
  try {
    const parts = templateId.split('_');
    const channel = parts[parts.length - 1];
    const templateType = parts.slice(0, -1).join('_');

    const { data: row } = await supabase
      .from('communication_templates')
      .select('body')
      .eq('entity_id', entityId)
      .eq('channel', channel)
      .eq('template_type', templateType)
      .single();

    if (row?.body) return render(row.body, data);
  } catch {}

  const fallback = fallbackTemplates[templateId];
  return fallback ? render(fallback.body, data) : data.body || '';
}

export async function getTemplateSubject(entityId: string, templateId: string, data: Record<string, string>): Promise<string> {
  try {
    const parts = templateId.split('_');
    const channel = parts[parts.length - 1];
    const templateType = parts.slice(0, -1).join('_');

    const { data: row } = await supabase
      .from('communication_templates')
      .select('subject')
      .eq('entity_id', entityId)
      .eq('channel', channel)
      .eq('template_type', templateType)
      .single();

    if (row?.subject) return render(row.subject, data);
  } catch {}

  const fallback = fallbackTemplates[templateId];
  return fallback?.subject ? render(fallback.subject, data) : '';
}
