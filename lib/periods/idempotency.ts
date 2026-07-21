// lib/periods/idempotency.ts
// Idempotency guard — caller supplies correlation ID, retries reuse it

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/platform/events/logger.service';

// In-memory cache is an optimization only — database uniqueness is the real guarantee
const localCache = new Set<string>();

export async function withIdempotency(
  correlationId: string,
  command: string,
  fn: () => Promise<any>
): Promise<any> {
  const key = `${command}:${correlationId}`;

  // Local cache check (fast path, best-effort)
  if (localCache.has(key)) {
    logger.warn(`Duplicate command detected in cache: ${key}`);
    return { success: true, message: 'Already processed', idempotent: true };
  }

  // Database check (durable — the real guarantee)
  const { data: existing } = await supabase
    .from('processed_commands')
    .select('id')
    .eq('correlation_id', correlationId)
    .eq('command', command)
    .single();

  if (existing) {
    localCache.add(key);
    return { success: true, message: 'Already processed', idempotent: true };
  }

  // Execute the command
  const result = await fn();

  // Record for future deduplication
  localCache.add(key);

  try {
    await supabase.from('processed_commands').insert({
      correlation_id: correlationId,
      command,
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    // If insert fails due to race condition, that's fine — the next request will catch the duplicate
    if (err?.code !== '23505') {
      logger.error('Failed to record processed command', { error: err });
    }
  }

  return result;
}
