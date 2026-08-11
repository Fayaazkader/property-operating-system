// lib/communications/whatsapp-templates.ts
// WhatsApp Business Templates — Required for out-of-session messages

export type WhatsAppTemplate = 
  | 'invoice_ready'
  | 'receipt_issued'
  | 'payment_overdue'
  | 'statement_ready'
  | 'lease_expiring'
  | 'maintenance_update';

export interface TemplateMessage {
  template: WhatsAppTemplate;
  to: string;
  variables: Record<string, string>;
  mediaUrl?: string;
}

// Twilio Content SIDs — approved templates
const CONTENT_SIDS: Record<WhatsAppTemplate, string> = {
  invoice_ready: process.env.TWILIO_CONTENT_SID_INVOICE || '',
  receipt_issued: process.env.TWILIO_CONTENT_SID_RECEIPT || '',
  payment_overdue: process.env.TWILIO_CONTENT_SID_OVERDUE || '',
  statement_ready: process.env.TWILIO_CONTENT_SID_STATEMENT || '',
  lease_expiring: process.env.TWILIO_CONTENT_SID_LEASE || '',
  maintenance_update: process.env.TWILIO_CONTENT_SID_MAINTENANCE || '',
};

export function buildTemplateMessage(params: TemplateMessage): {
  contentSid: string;
  contentVariables: string;
  mediaUrl?: string;
} {
  const contentSid = CONTENT_SIDS[params.template];
  
  // Convert variables to JSON string for Twilio
  const contentVariables = JSON.stringify(
    Object.entries(params.variables).reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>)
  );

  return {
    contentSid,
    contentVariables,
    mediaUrl: params.mediaUrl,
  };
}
