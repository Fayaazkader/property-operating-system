// lib/communications/providers/types.ts
// Provider abstractions — swap providers without changing business logic

export interface WhatsAppProvider {
  name: string;
  send(to: string, message: string): Promise<{ success: boolean; messageId: string; error?: string }>;
  getStatus(messageId: string): Promise<{ status: string; error?: string }>;
}

export interface EmailProvider {
  name: string;
  send(params: {
    to: string;
    subject: string;
    text: string;
    html: string;
    attachments?: Array<{ filename: string; content: string; type: string }>;
  }): Promise<{ success: boolean; messageId: string; error?: string }>;
  getStatus(messageId: string): Promise<{ status: string; error?: string }>;
}

export interface SMSProvider {
  name: string;
  send(to: string, message: string): Promise<{ success: boolean; messageId: string; error?: string }>;
  getStatus(messageId: string): Promise<{ status: string; error?: string }>;
}
