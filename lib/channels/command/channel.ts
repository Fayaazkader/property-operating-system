// lib/channels/command/channel.ts
// Command Channel — Web/UI conversations (Command Palette)

import { conversationPlatform } from "@/lib/conversation/platform";
import { ConversationRequest, ConversationResponse } from "@/lib/conversation/contract";
import { logger } from "@/lib/platform/events/logger.service";

export interface CommandRequest {
  message: string;
  userId?: string;
  tenantId?: string;
  propertyId?: string;
  role?: 'tenant' | 'property_manager' | 'finance' | 'executive' | 'unknown';
  sessionId?: string;
  conversationId?: string;
}

export interface CommandResponse {
  reply: string;
  cards?: {
    title: string;
    status: string;
    details: { label: string; value: string }[];
  }[];
  success: boolean;
  status: 'success' | 'error' | 'escalated' | 'needs_clarification' | 'pending';
}

export class CommandChannel {
  async process(request: CommandRequest): Promise<CommandResponse> {
    logger.info(`⌨️ Command from user ${request.userId}`, {
      message: request.message.substring(0, 50),
    });

    const conversationRequest: ConversationRequest = {
      channel: 'command',
      actor: {
        id: request.userId || 'unknown',
        type: 'user',
        role: request.role || 'unknown',
      },
      message: request.message,
      context: {
        conversationId: request.conversationId || crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        tenantId: request.tenantId,
        propertyId: request.propertyId,
        userId: request.userId,
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
      status: response.status,
    };
  }
}

export const commandChannel = new CommandChannel();
