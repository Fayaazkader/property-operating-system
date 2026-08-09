// lib/communications/providers/registry.ts
// Provider Registry — Swap providers via config

import { TwilioWhatsAppProvider } from './twilio-whatsapp';
import { SendGridEmailProvider } from './sendgrid-email';
import type { WhatsAppProvider, EmailProvider, SMSProvider } from './types';

const whatsappProviders: Map<string, WhatsAppProvider> = new Map();
const emailProviders: Map<string, EmailProvider> = new Map();
const smsProviders: Map<string, SMSProvider> = new Map();

// Register defaults
whatsappProviders.set('twilio', new TwilioWhatsAppProvider());
emailProviders.set('sendgrid', new SendGridEmailProvider());

export function getWhatsAppProvider(name?: string): WhatsAppProvider {
  return whatsappProviders.get(name || 'twilio')!;
}

export function getEmailProvider(name?: string): EmailProvider {
  return emailProviders.get(name || 'sendgrid')!;
}

export function getSMSProvider(name?: string): SMSProvider | undefined {
  return smsProviders.get(name || '');
}

export function registerWhatsAppProvider(name: string, provider: WhatsAppProvider): void {
  whatsappProviders.set(name, provider);
}

export function registerEmailProvider(name: string, provider: EmailProvider): void {
  emailProviders.set(name, provider);
}

export function registerSMSProvider(name: string, provider: SMSProvider): void {
  smsProviders.set(name, provider);
}
