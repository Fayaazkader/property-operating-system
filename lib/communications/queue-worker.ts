// lib/communications/queue-worker.ts
// Queue Worker — Atomic claim via RPC, production-ready

import { supabase } from '@/lib/supabase';
import { deliver } from './services/delivery-service';
import { logCommunication } from './services/audit-logger';
import { logger } from '@/lib/platform/events/logger.service';

export class CommunicationsWorker {
  private running = false;
  private interval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  start(intervalMs: number = 30000): void {
    if (this.running) return;
    this.running = true;
    logger.info('Communications Worker started');
    this.process();
    this.interval = setInterval(() => this.process(), intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    logger.info('Communications Worker stopped');
  }

  private async process(): Promise<void> {
    if (this.isProcessing) return; // Prevent overlapping runs
    this.isProcessing = true;

    try {
      const { data: messages, error } = await supabase.rpc('claim_next_messages', { p_limit: 50 });

      if (error) {
        logger.error('Claim messages error', { error });
        this.isProcessing = false;
        return;
      }

      if (!messages?.length) {
        this.isProcessing = false;
        return;
      }

      for (const msg of messages) {
        await this.processMessage(msg);
      }
    } catch (error) {
      logger.error('Queue worker error', { error });
    }
    this.isProcessing = false;
  }

  private async processMessage(msg: any): Promise<void> {
    try {
      const result = await deliver({
        channel: msg.channel,
        recipient: msg.recipient,
        subject: msg.subject,
        body: msg.body,
      });

      if (result.success) {
        await supabase.from('communications_queue').update({
          status: 'completed',
          provider_message_id: result.messageId,
          processed_at: new Date().toISOString(),
        }).eq('id', msg.id);

        await logCommunication({
          tenantId: msg.tenant_id,
          type: msg.type,
          channels: [msg.channel],
          body: msg.body,
          status: 'delivered',
          sourceId: msg.id,
        });
      } else {
        const attempts = (msg.attempts || 0) + 1;
        const maxAttempts = msg.max_attempts || 3;

        if (attempts < maxAttempts) {
          const backoffMinutes = Math.pow(2, attempts);
          const nextRetry = new Date(Date.now() + backoffMinutes * 60000).toISOString();

          await supabase.from('communications_queue').update({
            status: 'queued',
            attempts,
            last_error: result.error,
            next_retry_at: nextRetry,
          }).eq('id', msg.id);
        } else {
          await supabase.from('communications_queue').update({
            status: 'failed',
            attempts,
            last_error: result.error,
            processed_at: new Date().toISOString(),
          }).eq('id', msg.id);

          logger.error('Message permanently failed', { queueId: msg.id, attempts, error: result.error });
        }
      }
    } catch (error) {
      logger.error('Message processing error', { queueId: msg.id, error });
    }
  }
}

export const communicationsWorker = new CommunicationsWorker();
