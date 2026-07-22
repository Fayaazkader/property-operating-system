// lib/communications/whatsapp-sender.ts
// WhatsApp is a delivery channel, not a business engine.
// Revenue publishes InvoiceIssued → Communications decides Email/WhatsApp/SMS

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/platform/events/logger.service';

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export const whatsappSender = {
  async sendInvoice(tenantId: string, invoiceData: any): Promise<WhatsAppSendResult> {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('tenant_name, whatsapp_number, whatsapp_enabled')
      .eq('id', tenantId)
      .single();

    if (!tenant?.whatsapp_enabled || !tenant?.whatsapp_number) {
      return { success: false, error: 'WhatsApp not enabled or no number' };
    }

    const message = `📄 *Tax Invoice*\n\n${invoiceData.company_name || 'Your Landlord'}\n\nInvoice: ${invoiceData.invoice_number || 'N/A'}\nPeriod: ${invoiceData.period || 'Current'}\nTotal Due: R${(invoiceData.total || 0).toLocaleString()}`;

    return await this.send(tenant.whatsapp_number, message);
  },

  async sendStatement(tenantId: string, statementData: any): Promise<WhatsAppSendResult> {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('tenant_name, whatsapp_number, whatsapp_enabled')
      .eq('id', tenantId)
      .single();

    if (!tenant?.whatsapp_enabled || !tenant?.whatsapp_number) {
      return { success: false, error: 'WhatsApp not enabled or no number' };
    }

    const message = `📊 *Statement of Account*\n\n${statementData.company_name || 'Your Landlord'}\n\nPeriod: ${statementData.period || 'Current'}\nOpening: R${(statementData.opening_balance || 0).toLocaleString()}\nClosing: R${(statementData.closing_balance || 0).toLocaleString()}\nDue: R${(statementData.amount_due || 0).toLocaleString()}`;

    return await this.send(tenant.whatsapp_number, message);
  },

  async sendReminder(tenantId: string, amount: number, daysOverdue: number): Promise<WhatsAppSendResult> {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('tenant_name, whatsapp_number, whatsapp_enabled')
      .eq('id', tenantId)
      .single();

    if (!tenant?.whatsapp_enabled || !tenant?.whatsapp_number) {
      return { success: false, error: 'WhatsApp not enabled or no number' };
    }

    const message = `⚠️ *Payment Reminder*\n\nDear ${tenant.tenant_name},\n\nYour account is ${daysOverdue} days overdue.\nOutstanding: R${amount.toLocaleString()}\n\nPlease arrange payment or contact us.`;

    return await this.send(tenant.whatsapp_number, message);
  },

  async send(phoneNumber: string, message: string): Promise<WhatsAppSendResult> {
    try {
      const res = await fetch('/api/communications/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phoneNumber, message }),
      });
      const data = await res.json();
      return data;
    } catch (error: any) {
      logger.error('WhatsApp send failed', { error });
      return { success: false, error: error.message };
    }
  }
};
