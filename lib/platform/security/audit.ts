// lib/platform/security/audit.ts
// Audit Trail Service

import { supabase } from "@/lib/supabase";
import { logger } from "../events/logger.service";
import { AuditEntry, ResourceType } from './types';

export interface AuditLogParams {
  entity_id: string;
  entity_type: ResourceType;
  action: string;
  changes?: Record<string, any>;
  actor_id: string;
  actor_email?: string;
  actor_role?: string;
  correlation_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  private supabase = supabase;

  async log(params: AuditLogParams): Promise<void> {
    try {
      const entry = {
        entity_id: params.entity_id,
        entity_type: params.entity_type,
        action: params.action,
        changes: params.changes || {},
        actor_id: params.actor_id,
        actor_email: params.actor_email || null,
        actor_role: params.actor_role || null,
        correlation_id: params.correlation_id || crypto.randomUUID(),
        ip_address: params.ip_address || null,
        user_agent: params.user_agent || null,
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
      };

      await this.supabase.from('audit_log').insert(entry);

      logger.info(`📋 Audit: ${params.action} on ${params.entity_type} ${params.entity_id}`, {
        entityId: params.entity_id,
        entityType: params.entity_type,
        action: params.action,
        actorId: params.actor_id,
        correlationId: entry.correlation_id,
      });
    } catch (error) {
      logger.error('Failed to log audit entry:', { error, params });
    }
  }

  async getByEntity(entityId: string, entityType: ResourceType): Promise<AuditEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_log')
        .select('*')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch audit entries:', { error });
        return [];
      }

      return data as AuditEntry[];
    } catch (error) {
      logger.error('Failed to fetch audit entries:', { error });
      return [];
    }
  }

  async getByActor(actorId: string): Promise<AuditEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_log')
        .select('*')
        .eq('actor_id', actorId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch audit entries:', { error });
        return [];
      }

      return data as AuditEntry[];
    } catch (error) {
      logger.error('Failed to fetch audit entries:', { error });
      return [];
    }
  }

  async getByCorrelationId(correlationId: string): Promise<AuditEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_log')
        .select('*')
        .eq('correlation_id', correlationId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch audit entries:', { error });
        return [];
      }

      return data as AuditEntry[];
    } catch (error) {
      logger.error('Failed to fetch audit entries:', { error });
      return [];
    }
  }
}

export const auditService = new AuditService();
