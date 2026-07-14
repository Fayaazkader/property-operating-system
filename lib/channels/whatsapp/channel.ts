// lib/channels/whatsapp/channel.ts
// WhatsApp Channel — Adapts Twilio to Conversation Platform

import { conversationPlatform } from "@/lib/conversation/platform";
import { ConversationRequest } from "@/lib/conversation/contract";
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

export class WhatsAppChannel {
  private provider: string;

  constructor(provider: string = 'twilio') {
    this.provider = provider;
  }

  async process(message: WhatsAppMessage): Promise<WhatsAppResponse> {
    logger.info(`📩 WhatsApp message from ${message.from}`, {
      messageId: message.id,
      body: message.body.substring(0, 50),
    });

    const request: ConversationRequest = {
      channel: 'whatsapp',
      actor: {
        id: 'whatsapp',
        type: 'tenant',
        role: 'tenant',
      },
      message: message.body,
      context: {
        conversationId: message.id,
        correlationId: message.id,
      },
      channelMetadata: {
        messageId: message.id,
        from: message.from,
        mediaUrls: message.mediaUrls,
        provider: this.provider,
        direction: 'inbound',
      },
      timestamp: message.timestamp || new Date().toISOString(),
    };

    const response = await conversationPlatform.process(request);

    return {
      reply: response.message,
      buttons: response.channelFormat?.whatsapp?.buttons,
    };
  }

  formatTwilioResponse(response: WhatsAppResponse): string {
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

export const whatsappChannel = new WhatsAppChannel('twilio');
