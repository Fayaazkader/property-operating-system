// lib/adapters/whatsapp/adapter.ts
// WhatsApp Adapter — Handles WhatsApp communication
// Twilio is an implementation detail

import { supabase } from "@/lib/supabase";
import { publish, Events } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";

export interface WhatsAppMessage {
  id: string;
  from: string;
  body: string;
  mediaUrls?: string[];
  mediaCount?: number;
  timestamp: string;
  provider: 'twilio' | 'meta' | 'infobip';
}

export interface WhatsAppResponse {
  reply: string;
  buttons?: { label: string; action: string }[];
}

export class WhatsAppAdapter {
  private provider: string;

  constructor(provider: string = 'twilio') {
    this.provider = provider;
  }

  async processIncomingMessage(message: WhatsAppMessage): Promise<WhatsAppResponse> {
    // 1. Find tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, tenant_name, entity_id')
      .eq('whatsapp_number', message.from)
      .single();

    // 2. Handle unknown tenant
    if (tenantError || !tenant) {
      logger.warn(`Unknown WhatsApp sender: ${message.from}`);
      return {
        reply: "Thanks for your message. We couldn't verify this number against an active tenant profile. Please contact your property manager if you believe this is incorrect.",
      };
    }

    // 3. Store communication
    await supabase.from('communications').insert({
      tenant_id: tenant.id,
      event_type: 'whatsapp_inbound',
      channel: 'whatsapp',
      message_body: message.body,
      status: 'received',
      source_type: 'whatsapp',
      source_id: message.id,
      external_message_id: message.id,
      media_urls: message.mediaUrls,
      created_at: new Date().toISOString(),
    });

    // 4. Publish event
    await publish('whatsapp.message.received', {
      correlationId: message.id,
      source: 'whatsapp-adapter',
      version: '1.0',
      actor: {
        id: tenant.id,
        type: 'tenant',
      },
      entity: {
        id: tenant.id,
        type: 'tenant',
        tenantId: tenant.id,
      },
      payload: {
        messageId: message.id,
        from: message.from,
        body: message.body,
        mediaUrls: message.mediaUrls || [],
        mediaCount: message.mediaCount || 0,
        timestamp: message.timestamp,
        provider: this.provider,
        channel: 'whatsapp',
        direction: 'inbound',
      },
    });

    // 5. TODO: Route to Conversation Engine
    // const response = await conversationEngine.process(tenant.id, message.body);

    // 6. For now, return acknowledgment
    return {
      reply: `Thanks for your message, ${tenant.tenant_name}! We'll get back to you shortly.`,
    };
  }

  // Format response for Twilio
  formatTwilioResponse(response: WhatsAppResponse): string {
    // Build TwiML
    let twiml = '<?xml version="1.0" encoding="UTF-8"?>';
    twiml += '<Response>';
    twiml += `<Message>${this.escapeXml(response.reply)}</Message>`;
    twiml += '</Response>';
    return twiml;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const whatsappAdapter = new WhatsAppAdapter('twilio');
