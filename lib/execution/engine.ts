// lib/execution/engine.ts
// Execution Engine — Single Authority for All Execution Operations

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Execution,
  ExecutionContext,
  ExecutionResult,
  ExecutionStatus,
  SourceType,
  CreateExecutionParams,
  SendExecutionParams,
  ReadyScoreResult,
  ExecutionPolicy,
} from './types';
import { logExecutionEvent } from './events';
import { generateSigningLink } from './links';

export class ExecutionEngine {
  private supabase: SupabaseClient;
  private userId?: string;
  private ipAddress?: string;
  private userAgent?: string;

  constructor(context: ExecutionContext) {
    this.supabase = context.supabase;
    this.userId = context.userId;
    this.ipAddress = context.ipAddress;
    this.userAgent = context.userAgent;
  }

  // ============================================================
  // GET — Retrieve execution
  // ============================================================

  async get(executionId: string): Promise<Execution | null> {
    const { data, error } = await this.supabase
      .from('executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Execution;
  }

  // ============================================================
  // GET ACTIVE — Get active execution for a source
  // ============================================================

  async getActiveExecution(sourceType: SourceType, sourceId: string): Promise<Execution | null> {
    const { data, error } = await this.supabase
      .from('executions')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .not('status', 'in', '("executed","activated","cancelled","expired")')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Execution;
  }

  // ============================================================
  // GET PARTICIPANTS — Get all participants for an execution
  // ============================================================

  async getParticipants(executionId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('execution_participants')
      .select('*')
      .eq('execution_id', executionId)
      .order('signing_order', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data;
  }

  // ============================================================
  // CREATE — Generate a new execution
  // ============================================================

  async create(params: CreateExecutionParams): Promise<ExecutionResult> {
    try {
      const { data, error } = await this.supabase
        .from('executions')
        .insert({
          source_type: params.source_type,
          source_id: params.source_id,
          version: 1,
          status: 'draft',
          provider: params.provider || 'native',
          signing_method: params.signing_method || 'standard',
          signing_order: params.signing_order || 'sequential',
          sla_days: params.sla_days || 7,
          effective_date: params.effective_date || null,
          metadata: params.metadata || {},
          created_by: this.userId,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          execution_id: '',
          status: 'draft',
          errors: [error.message],
        };
      }

      await logExecutionEvent({
        supabase: this.supabase,
        executionId: data.id,
        eventType: 'draft_generated',
        eventData: { params },
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
        userId: this.userId,
      });

      return {
        success: true,
        execution_id: data.id,
        status: data.status,
        message: 'Execution draft created',
        data: data,
      };

    } catch (error) {
      return {
        success: false,
        execution_id: '',
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // ADD PARTICIPANT — Add a participant to an execution
  // ============================================================

  async addParticipant(params: {
    execution_id: string;
    participant_type: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    signing_order?: number;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('execution_participants')
        .insert({
          execution_id: params.execution_id,
          participant_type: params.participant_type,
          name: params.name,
          email: params.email,
          phone: params.phone,
          company: params.company,
          signing_order: params.signing_order || 0,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, id: data.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================
  // GET READY SCORE — Validate before sending
  // ============================================================

  async getReadyScore(executionId: string): Promise<ReadyScoreResult> {
    const execution = await this.get(executionId);
    if (!execution) {
      return {
        score: 0,
        checks: [],
        can_proceed: false,
      };
    }

    const participants = await this.getParticipants(executionId);
    const hasParticipants = participants && participants.length > 0;
    const isDraft = execution.status === 'draft';

    const checks = [
      {
        key: 'participants',
        label: 'Participants assigned',
        passed: isDraft ? true : !!hasParticipants,
        required: true,
        message: !hasParticipants && !isDraft ? 'At least one participant is required' : undefined,
      },
    ];

    const requiredChecks = checks.filter(c => c.required);
    const passedChecks = checks.filter(c => c.passed);
    const score = requiredChecks.length > 0 ? Math.round((passedChecks.length / requiredChecks.length) * 100) : 0;
    const canProceed = requiredChecks.every(c => c.passed);

    return { score, checks, can_proceed: canProceed };
  }

  // ============================================================
  // SEND — Send for execution
  // ============================================================

  async send(params: SendExecutionParams): Promise<ExecutionResult> {
    try {
      const execution = await this.get(params.execution_id);
      if (!execution) {
        return {
          success: false,
          execution_id: params.execution_id,
          status: 'draft',
          errors: ['Execution not found'],
        };
      }

      if (['sent', 'viewed', 'partially_signed'].includes(execution.status)) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: ['Execution is already in progress'],
        };
      }

      const readiness = await this.getReadyScore(params.execution_id);
      if (!readiness.can_proceed) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: ['Cannot send: validation failed'],
        };
      }

      // Add participants
      const participantsToAdd = params.participants || [];
      for (const p of participantsToAdd) {
        await this.addParticipant({
          execution_id: params.execution_id,
          participant_type: p.participant_type,
          name: p.name,
          email: p.email,
          phone: p.phone,
          company: p.company,
          signing_order: participantsToAdd.indexOf(p) + 1,
        });
      }

      // Update execution status
      const { data, error } = await this.supabase
        .from('executions')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', params.execution_id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [error.message],
        };
      }

      // Update participants
      await this.supabase
        .from('execution_participants')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('execution_id', params.execution_id);

      // Generate signing links
      const allParticipants = await this.getParticipants(params.execution_id);
      for (const p of allParticipants) {
        const link = await generateSigningLink(p.id, params.execution_id);
        console.log(`🔗 Signing link for ${p.name}: ${link}`);
      }

      await logExecutionEvent({
        supabase: this.supabase,
        executionId: params.execution_id,
        eventType: 'sent',
        eventData: { participants: participantsToAdd },
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
        userId: this.userId,
      });

      return {
        success: true,
        execution_id: data.id,
        status: data.status,
        message: 'Execution sent successfully',
        data: data,
      };

    } catch (error) {
      return {
        success: false,
        execution_id: params.execution_id,
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // SIGN — Record a participant's signature
  // ============================================================

  async sign(params: {
    executionId: string;
    participantId: string;
    signature: string;
    signatureMethod?: 'typed' | 'drawn' | 'otp' | 'qualified';
    ipAddress?: string;
    userAgent?: string;
    timezone?: string;
  }): Promise<ExecutionResult> {
    try {
      const execution = await this.get(params.executionId);
      if (!execution) {
        return {
          success: false,
          execution_id: params.executionId,
          status: 'draft',
          errors: ['Execution not found'],
        };
      }

      if (!['sent', 'viewed', 'partially_signed'].includes(execution.status)) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [`Cannot sign: execution is in "${execution.status}" state`],
        };
      }

      const { data: participant, error: pError } = await this.supabase
        .from('execution_participants')
        .select('*')
        .eq('id', params.participantId)
        .eq('execution_id', params.executionId)
        .single();

      if (pError || !participant) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: ['Participant not found'],
        };
      }

      if (participant.status === 'signed') {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: ['Already signed'],
        };
      }

      const now = new Date().toISOString();

      const { error: updateError } = await this.supabase
        .from('execution_participants')
        .update({
          status: 'signed',
          signed_at: now,
          signature_data: {
            type: params.signatureMethod || 'typed',
            value: params.signature,
            signed_at: now,
            ip_address: params.ipAddress,
            user_agent: params.userAgent,
            timezone: params.timezone,
          },
          ip_address: params.ipAddress,
          user_agent: params.userAgent,
        })
        .eq('id', params.participantId);

      if (updateError) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [updateError.message],
        };
      }

      await logExecutionEvent({
        supabase: this.supabase,
        executionId: params.executionId,
        eventType: 'signed',
        eventData: {
          participant_id: params.participantId,
          participant_name: participant.name,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        userId: this.userId,
      });

      // Check if all signed
      const { data: allParticipants } = await this.supabase
        .from('execution_participants')
        .select('status')
        .eq('execution_id', params.executionId);

      const allSigned = allParticipants?.every(p => p.status === 'signed');

      if (allSigned) {
        return await this.execute(params.executionId);
      }

      await this.supabase
        .from('executions')
        .update({
          status: 'partially_signed',
        })
        .eq('id', params.executionId);

      const remaining = allParticipants?.filter(p => p.status !== 'signed') || [];
      return {
        success: true,
        execution_id: execution.id,
        status: 'partially_signed',
        message: `${participant.name} signed. ${remaining.length} more signatures needed.`,
        data: { participant, remaining },
      };

    } catch (error) {
      return {
        success: false,
        execution_id: params.executionId,
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // EXECUTE — Complete execution when all signed
  // ============================================================

  async execute(executionId: string): Promise<ExecutionResult> {
    try {
      const execution = await this.get(executionId);
      if (!execution) {
        return {
          success: false,
          execution_id: executionId,
          status: 'draft',
          errors: ['Execution not found'],
        };
      }

      if (['executed', 'activated'].includes(execution.status)) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: ['Already completed'],
        };
      }

      const participants = await this.getParticipants(executionId);
      const allSigned = participants.every(p => p.status === 'signed');

      if (!allSigned) {
        const unsigned = participants.filter(p => p.status !== 'signed');
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [`${unsigned.length} participant(s) have not signed`],
        };
      }

      const now = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('executions')
        .update({
          status: 'executed',
          executed_at: now,
        })
        .eq('id', executionId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [error.message],
        };
      }

      await this.supabase
        .from('execution_participants')
        .update({ status: 'completed' })
        .eq('execution_id', executionId);

      await logExecutionEvent({
        supabase: this.supabase,
        executionId: executionId,
        eventType: 'executed',
        eventData: { participants: participants.length },
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
        userId: this.userId,
      });

      return {
        success: true,
        execution_id: data.id,
        status: data.status,
        message: 'Execution completed successfully',
        data: data,
      };

    } catch (error) {
      return {
        success: false,
        execution_id: executionId,
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // GET POLICY — Get policy for source
  // ============================================================

  async getPolicyForSource(sourceType: SourceType, sourceId: string): Promise<ExecutionPolicy | null> {
    try {
      let sourceData: any = null;

      if (sourceType === 'lease') {
        const { data } = await this.supabase
          .from('leases')
          .select('owner_entity_id, managing_entity_id')
          .eq('id', sourceId)
          .single();
        sourceData = data;
      }

      if (!sourceData) {
        return null;
      }

      const entityId = sourceData.owner_entity_id || sourceData.managing_entity_id;

      if (!entityId) {
        return null;
      }

      const { data, error } = await this.supabase
        .from('execution_policies')
        .select('*')
        .eq('entity_id', entityId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error || !data) {
        return {
          id: 'default',
          entity_id: null,
          portfolio_id: null,
          policy_name: 'Default Policy',
          requires_review: true,
          requires_otp: false,
          signing_order: 'sequential',
          reminder_frequency_days: 3,
          expiry_days: 14,
          required_documents: [],
          required_participants: [],
          default_signing_method: 'standard',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      return data as ExecutionPolicy;

    } catch (error) {
      return null;
    }
  }

  // ============================================================
  // ACTIVATE — Trigger activation
  // ============================================================

  async activate(executionId: string): Promise<ExecutionResult> {
    try {
      const execution = await this.get(executionId);
      if (!execution) {
        return {
          success: false,
          execution_id: executionId,
          status: 'draft',
          errors: ['Execution not found'],
        };
      }

      if (execution.status !== 'executed') {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: ['Cannot activate: execution not yet executed'],
        };
      }

      const { data, error } = await this.supabase
        .from('executions')
        .update({
          status: 'activated',
          activated_at: new Date().toISOString(),
        })
        .eq('id', executionId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [error.message],
        };
      }

      await logExecutionEvent({
        supabase: this.supabase,
        executionId: executionId,
        eventType: 'activated',
        eventData: { source_type: execution.source_type, source_id: execution.source_id },
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
        userId: this.userId,
      });

      return {
        success: true,
        execution_id: data.id,
        status: data.status,
        message: 'Execution activated successfully',
        data: data,
      };

    } catch (error) {
      return {
        success: false,
        execution_id: executionId,
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }
}

// ============================================================
// Factory function
// ============================================================

export function createExecutionEngine(
  supabase: SupabaseClient,
  options?: { userId?: string; ipAddress?: string; userAgent?: string }
): ExecutionEngine {
  return new ExecutionEngine({
    supabase,
    userId: options?.userId,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  });
}