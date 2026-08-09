// lib/communications/template-engine.ts
// Template Engine — DB-backed with code fallbacks

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

async function getTemplate(entityId: string, templateId: string): Promise<{ subject?: string; body: string }> {
  const [channel, ...typeParts] = templateId.split('_').reverse();
  const templateType = typeParts.reverse().join('_');

  const { data } = await supabase
    .from('communication_templates')
    .select('subject, body')
    .eq('entity_id', entityId)
    .eq('channel', channel)
    .eq('template_type', templateType)
    .single();

  if (data) return { subject: data.subject || undefined, body: data.body };

  return fallbackTemplates[templateId] || { body: '' };
}

export function getTemplateBody(entityId: string, templateId: string, data: Record<string, string>): string {
  // Async in real usage — simplified for sync template rendering
  const fallback = fallbackTemplates[templateId];
  if (!fallback) return data.body || '';

  let rendered = fallback.body;
  for (const [key, value] of Object.entries(data)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return rendered;
}

export function getTemplateSubject(entityId: string, templateId: string, data: Record<string, string>): string {
  const fallback = fallbackTemplates[templateId];
  if (!fallback?.subject) return '';

  let rendered = fallback.subject;
  for (const [key, value] of Object.entries(data)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return rendered;
}
