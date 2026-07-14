// lib/channels/morning-brief/channel.ts
// Morning Brief Channel — Scheduled daily briefings

import { conversationPlatform } from "@/lib/conversation/platform";
import { ConversationRequest } from "@/lib/conversation/contract";
import { logger } from "@/lib/platform/events/logger.service";

export interface MorningBriefRequest {
  userId: string;
  tenantId?: string;
  entityId: string;
  role: 'tenant' | 'property_manager' | 'finance' | 'executive';
  channel?: 'whatsapp' | 'email' | 'web';
}

export interface MorningBriefResponse {
  reply: string;
  cards?: {
    title: string;
    status: string;
    details: { label: string; value: string }[];
  }[];
  success: boolean;
}

export class MorningBriefChannel {
  async generate(request: MorningBriefRequest): Promise<MorningBriefResponse> {
    logger.info(`🌅 Generating Morning Brief for user ${request.userId}`);

    const message = this.buildBriefQuery(request);

    const conversationRequest: ConversationRequest = {
      channel: 'morning-brief',
      actor: {
        id: request.userId,
        type: 'user',
        role: request.role,
      },
      message,
      context: {
        conversationId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        tenantId: request.tenantId,
        entityId: request.entityId,
        userId: request.userId,
      },
      channelMetadata: {
        deliveryChannel: request.channel || 'web',
        scheduled: true,
      },
      timestamp: new Date().toISOString(),
    };

    const response = await conversationPlatform.process(conversationRequest);

    return {
      reply: response.message,
      cards: response.cards?.map(c => ({
        title: c.title,
        status: c.status,
        details: c.details || [],
      })),
      success: response.success,
    };
  }

  private buildBriefQuery(request: MorningBriefRequest): string {
    const parts = ['Morning Brief'];
    if (request.tenantId) {
      parts.push(`for tenant ${request.tenantId}`);
    }
    parts.push('including revenue, arrears, expiring leases, and key tasks');
    return parts.join(' ');
  }
}

export const morningBriefChannel = new MorningBriefChannel();
