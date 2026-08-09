// lib/communications/template-engine.ts
// Template Engine — Renders messages from templates with placeholders

export interface CommunicationTemplate {
  id: string;
  type: string;
  subject?: string;
  body: string;
  channel: 'email' | 'whatsapp' | 'sms';
}

const defaultTemplates: Record<string, CommunicationTemplate> = {
  statement_ready_email: {
    id: 'statement_ready_email',
    type: 'statement',
    subject: 'Your Statement — {{tenant_name}}',
    body: `Dear {{tenant_name}},\n\nYour statement for {{period}} is now available.\n\nAmount Due: {{amount}}\n\nView your statement: {{link}}\n\nThank you,\n{{entity_name}}`,
    channel: 'email',
  },
  statement_ready_whatsapp: {
    id: 'statement_ready_whatsapp',
    type: 'statement',
    body: `📄 Your statement for {{period}} is ready.\nAmount Due: {{amount}}\nView: {{link}}`,
    channel: 'whatsapp',
  },
  invoice_ready_email: {
    id: 'invoice_ready_email',
    type: 'invoice',
    subject: 'Invoice {{invoice_number}} — {{tenant_name}}',
    body: `Dear {{tenant_name}},\n\nYour invoice {{invoice_number}} is ready.\n\nAmount: {{amount}}\nDue Date: {{due_date}}\n\nView invoice: {{link}}\n\nThank you,\n{{entity_name}}`,
    channel: 'email',
  },
  invoice_ready_whatsapp: {
    id: 'invoice_ready_whatsapp',
    type: 'invoice',
    body: `🧾 Invoice {{invoice_number}}\nAmount: {{amount}}\nDue: {{due_date}}\nView: {{link}}`,
    channel: 'whatsapp',
  },
  receipt_email: {
    id: 'receipt_email',
    type: 'receipt',
    subject: 'Payment Received — {{tenant_name}}',
    body: `Dear {{tenant_name}},\n\nWe have received your payment of {{amount}}.\n\nReference: {{reference}}\nDate: {{date}}\n\nThank you,\n{{entity_name}}`,
    channel: 'email',
  },
  receipt_whatsapp: {
    id: 'receipt_whatsapp',
    type: 'receipt',
    body: `✅ Payment received: {{amount}}\nReference: {{reference}}\nThank you!`,
    channel: 'whatsapp',
  },
};

export function renderTemplate(templateId: string, data: Record<string, string>): string {
  const template = defaultTemplates[templateId];
  if (!template) return data.body || '';

  let rendered = template.body;
  for (const [key, value] of Object.entries(data)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return rendered;
}

export function getTemplateSubject(templateId: string, data: Record<string, string>): string {
  const template = defaultTemplates[templateId];
  if (!template?.subject) return '';

  let rendered = template.subject;
  for (const [key, value] of Object.entries(data)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return rendered;
}
