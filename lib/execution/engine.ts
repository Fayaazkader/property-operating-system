// lib/execution/engine.ts
// Execution Engine — Single Authority for All Execution Operations
// 
// ⚠️ IMPORTANT: All status changes MUST go through this engine.
// Never update executions.status directly in SQL or via direct Supabase queries.
// This ensures: validation, events, audit, notifications, and SLA tracking.

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Execution,
  ExecutionContext,
  ExecutionResult,
  ExecutionStatus,
  ExecutionProvider,
  SigningMethod,
  SigningOrder,
  SourceType,
  CreateExecutionParams,
  SendExecutionParams,
  ReadyScoreResult,
  ExecutionPolicy,
} from './types';
import { logExecutionEvent } from './events';
import { generateSigningLink } from './links';

// ============================================================
// Execution Engine Class
// ============================================================

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
  // 1. CREATE — Generate a new execution
  // ============================================================

  async create(params: CreateExecutionParams): Promise<ExecutionResult> {
    try {
      // Validate source exists
      const sourceExists = await this.validateSource(params.source_type, params.source_id);
      if (!sourceExists) {
        return {
          success: false,
          execution_id: '',
          status: 'draft',
          errors: [`Source ${params.source_type} with ID ${params.source_id} not found`],
        };
      }

      // Check if active execution already exists
      const active = await this.getActiveExecution(params.source_type, params.source_id);
      if (active) {
        return {
          success: false,
          execution_id: active.id,
          status: active.status,
          errors: ['An active execution already exists for this source'],
        };
      }

      // Get policy for this source
      const policy = await this.getPolicyForSource(params.source_type, params.source_id);

      // Create execution
      const { data, error } = await this.supabase
        .from('executions')
        .insert({
          source_type: params.source_type,
          source_id: params.source_id,
          version: 1,
          status: 'draft' as ExecutionStatus,
          provider: params.provider || 'native',
          signing_method: params.signing_method || policy?.default_signing_method || 'standard',
          signing_order: params.signing_order || policy?.signing_order || 'sequential',
          sla_days: params.sla_days || policy?.expiry_days || 7,
          effective_date: params.effective_date || null,
          metadata: params.metadata || {},
          created_by: this.userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Execution create error:', error);
        return {
          success: false,
          execution_id: '',
          status: 'draft',
          errors: [error.message],
        };
      }

      // Log event
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
      console.error('Execution create error:', error);
      return {
        success: false,
        execution_id: '',
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // 2. GET — Retrieve execution details
  // ============================================================

  async get(executionId: string): Promise<Execution | null> {
    const { data, error } = await this.supabase
      .from('executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error || !data) {
      console.error('Execution get error:', error);
      return null;
    }

    return data as Execution;
  }

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
  // 3. READY SCORE — Validate before sending
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

    // Get source data for validation
    const sourceData = await this.getSourceData(execution.source_type, execution.source_id);

    const checks: { key: string; label: string; passed: boolean; required: boolean; message?: string }[] = [];

    // Check 1: Source exists
    checks.push({
      key: 'source_exists',
      label: 'Source record exists',
      passed: !!sourceData,
      required: true,
      message: !sourceData ? 'Source record not found' : undefined,
    });

    // Check 2: Tenant exists (for leases)
    if (execution.source_type === 'lease' && sourceData) {
      const hasTenant = sourceData.tenant_id || sourceData.tenant_name;
      checks.push({
        key: 'tenant_exists',
        label: 'Tenant assigned',
        passed: !!hasTenant,
        required: true,
        message: !hasTenant ? 'No tenant assigned to this lease' : undefined,
      });
    }

    // Check 3: Property exists (for leases)
    if (execution.source_type === 'lease' && sourceData) {
      const hasProperty = sourceData.property_id || sourceData.property_name;
      checks.push({
        key: 'property_exists',
        label: 'Property assigned',
        passed: !!hasProperty,
        required: true,
        message: !hasProperty ? 'No property assigned to this lease' : undefined,
      });
    }

    // Check 4: Commencement date
    if (sourceData) {
      const hasDate = sourceData.commencement_date || sourceData.lease_start_date;
      checks.push({
        key: 'commencement_date',
        label: 'Commencement date set',
        passed: !!hasDate,
        required: true,
        message: !hasDate ? 'Commencement date is required' : undefined,
      });
    }

    // Check 5: Monthly rental
    if (sourceData) {
      const hasRental = sourceData.monthly_rental && sourceData.monthly_rental > 0;
      checks.push({
        key: 'monthly_rental',
        label: 'Monthly rental amount set',
        passed: !!hasRental,
        required: true,
        message: !hasRental ? 'Monthly rental amount is required' : undefined,
      });
    }

    // Check 6: Deposit
    if (sourceData) {
      const hasDeposit = sourceData.deposit_amount && sourceData.deposit_amount > 0;
      checks.push({
        key: 'deposit_amount',
        label: 'Deposit amount set',
        passed: !!hasDeposit,
        required: true,
        message: !hasDeposit ? 'Deposit amount is required' : undefined,
      });
    }

    // Check 7: Escalation
    if (sourceData) {
      const hasEscalation = sourceData.escalation_percent !== undefined && sourceData.escalation_percent !== null;
      checks.push({
        key: 'escalation',
        label: 'Escalation percentage set',
        passed: hasEscalation,
        required: true,
        message: !hasEscalation ? 'Escalation percentage is required' : undefined,
      });
    }

    // Check 8: Participants assigned
    // Check 8: Participants assigned
const participants = await this.getParticipants(executionId);
const hasParticipants = participants && participants.length > 0;
// If in draft state, don't require participants yet
const isDraft = execution.status === 'draft';
checks.push({
  key: 'participants',
  label: 'Participants assigned',
  passed: isDraft ? true : !!hasParticipants,
  required: true,
  message: !hasParticipants && !isDraft ? 'At least one participant is required' : undefined,
});

    // Calculate score
    const requiredChecks = checks.filter(c => c.required);
    const passedChecks = checks.filter(c => c.passed);
    const passedCount = passedChecks.length;
    const requiredCount = requiredChecks.length;
    const score = requiredCount > 0 ? Math.round((passedCount / requiredCount) * 100) : 0;

    // Determine if can proceed (all required checks passed)
    const canProceed = requiredChecks.every(c => c.passed);

    return {
      score,
      checks,
      can_proceed: canProceed,
    };
  }

  // ============================================================
  // 4. SEND — Send for execution (LOCKS + SNAPSHOT)
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

      // Check if already in progress
      if (['sent', 'viewed', 'partially_signed'].includes(execution.status)) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: ['Execution is already in progress'],
        };
      }

      // Check if already executed
      if (['executed', 'activated'].includes(execution.status)) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: ['Execution is already completed'],
        };
      }

      // Validate ready score
      const readiness = await this.getReadyScore(params.execution_id);
      if (!readiness.can_proceed) {
        const failedChecks = readiness.checks
          .filter(c => c.required && !c.passed)
          .map(c => c.label);
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [`Cannot send: ${failedChecks.join(', ')} required`],
          warnings: readiness.checks.filter(c => !c.required && !c.passed).map(c => c.label),
        };
      }

      // Validate participants
      if (!params.participants || params.participants.length === 0) {
        const existingParticipants = await this.getParticipants(params.execution_id);
        if (!existingParticipants || existingParticipants.length === 0) {
          return {
            success: false,
            execution_id: execution.id,
            status: execution.status,
            errors: ['No participants assigned to execution'],
          };
        }
      }

      // Begin transaction: update execution status to 'sent'
      // This triggers:
      // - Lock (is_locked = true)
      // - Snapshot capture
      // - SLA expiry date set

      const { data, error } = await this.supabase
        .from('executions')
        .update({
          status: 'sent' as ExecutionStatus,
          sent_at: new Date().toISOString(),
        })
        .eq('id', params.execution_id)
        .select()
        .single();

      if (error) {
        console.error('Execution send error:', error);
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [error.message],
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

// ⭐ After adding participants, fetch them to generate links
const allParticipants = await this.getParticipants(params.execution_id);
for (const p of allParticipants) {
  const link = await generateSigningLink(p.id, params.execution_id);
  console.log(`Signing link for ${p.name}: ${link}`);
  // TODO: Send via WhatsApp/Email
}

      // Update participant statuses to 'sent'
      await this.supabase
        .from('execution_participants')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('execution_id', params.execution_id);

      // Log event
      await logExecutionEvent({
        supabase: this.supabase,
        executionId: params.execution_id,
        eventType: 'sent',
        eventData: { participants: participantsToAdd, message: params.message },
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
        userId: this.userId,
      });

      // TODO: Send notifications (WhatsApp/Email)
      // await this.sendNotifications(execution, participantsToAdd, params.message);

      return {
        success: true,
        execution_id: data.id,
        status: data.status,
        message: 'Execution sent successfully',
        data: data,
      };

    } catch (error) {
      console.error('Execution send error:', error);
      return {
        success: false,
        execution_id: params.execution_id,
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // 5. PARTICIPANTS — Add/Update participants
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
  // 6. SIGN — Record a signature
  // ============================================================

  async signParticipant(params: {
    execution_id: string;
    participant_id: string;
    ip_address?: string;
    user_agent?: string;
    device_info?: any;
    location?: string;
  }): Promise<ExecutionResult> {
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

      // Check if execution is in a signable state
      if (!['sent', 'viewed', 'partially_signed'].includes(execution.status)) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [`Cannot sign: execution is in "${execution.status}" state`],
        };
      }

      // Update participant
      const { data: participant, error: pError } = await this.supabase
        .from('execution_participants')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          ip_address: params.ip_address,
          user_agent: params.user_agent,
          device_info: params.device_info || {},
          location: params.location,
        })
        .eq('id', params.participant_id)
        .eq('execution_id', params.execution_id)
        .select()
        .single();

      if (pError) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [pError.message],
        };
      }

      // Log event
      await logExecutionEvent({
        supabase: this.supabase,
        executionId: params.execution_id,
        eventType: 'signed',
        eventData: { participant: participant },
        ipAddress: params.ip_address,
        userAgent: params.user_agent,
        userId: this.userId,
      });

      // Check if all participants have signed
      const allParticipants = await this.getParticipants(params.execution_id);
      const allSigned = allParticipants.every(p => p.status === 'signed');

      if (allSigned) {
        // ALL SIGNED — Execute!
        return await this.execute(params.execution_id);
      }

      // Update status to partially_signed
      await this.supabase
        .from('executions')
        .update({
          status: 'partially_signed' as ExecutionStatus,
        })
        .eq('id', params.execution_id);

      return {
        success: true,
        execution_id: execution.id,
        status: 'partially_signed',
        message: `${participant.name} signed successfully. Awaiting ${allParticipants.filter(p => p.status !== 'signed').length} more signatures.`,
        data: { participant, remaining: allParticipants.filter(p => p.status !== 'signed') },
      };

    } catch (error) {
      console.error('Sign error:', error);
      return {
        success: false,
        execution_id: params.execution_id,
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // 7. EXECUTE — Complete execution (all signed)
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

      // Check if already executed
      if (['executed', 'activated'].includes(execution.status)) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: ['Execution is already completed'],
        };
      }

      // Verify all participants signed
      const participants = await this.getParticipants(executionId);
      const allSigned = participants.every(p => p.status === 'signed');
      if (!allSigned) {
        const unsigned = participants.filter(p => p.status !== 'signed');
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [`Cannot execute: ${unsigned.length} participant(s) have not signed`],
        };
      }

      // Update execution status to 'executed'
      const { data, error } = await this.supabase
        .from('executions')
        .update({
          status: 'executed' as ExecutionStatus,
          executed_at: new Date().toISOString(),
        })
        .eq('id', executionId)
        .select()
        .single();

      if (error) {
        console.error('Execute error:', error);
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [error.message],
        };
      }

      // Update all participants to completed
      await this.supabase
        .from('execution_participants')
        .update({
          status: 'completed',
        })
        .eq('execution_id', executionId);

      // Log event
      await logExecutionEvent({
        supabase: this.supabase,
        executionId: executionId,
        eventType: 'executed',
        eventData: { participants: participants.length },
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
        userId: this.userId,
      });

      // TODO: Generate execution certificate
      // await this.generateCertificate(executionId);

      // TODO: Publish execution.executed event
      // await this.publishEvent(executionId, 'lease.execution.executed');

      return {
        success: true,
        execution_id: data.id,
        status: data.status,
        message: 'Execution completed successfully',
        data: data,
      };

    } catch (error) {
      console.error('Execute error:', error);
      return {
        success: false,
        execution_id: executionId,
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // 8. ACTIVATE — Trigger activation (calls Sprint 1)
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

      // Must be executed first
      if (execution.status !== 'executed') {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [`Cannot activate: execution is in "${execution.status}" state. Must be executed first.`],
        };
      }

      // Update execution status to 'activated'
      const { data, error } = await this.supabase
        .from('executions')
        .update({
          status: 'activated' as ExecutionStatus,
          activated_at: new Date().toISOString(),
        })
        .eq('id', executionId)
        .select()
        .single();

      if (error) {
        console.error('Activate error:', error);
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [error.message],
        };
      }

      // Update source record (lease) with execution details
      if (execution.source_type === 'lease') {
        await this.supabase
          .from('leases')
          .update({
            active_execution_id: executionId,
            current_execution_version: execution.version,
          })
          .eq('id', execution.source_id);
      }

      // Log event
      await logExecutionEvent({
        supabase: this.supabase,
        executionId: executionId,
        eventType: 'activated',
        eventData: { source_type: execution.source_type, source_id: execution.source_id },
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
        userId: this.userId,
      });

      // TODO: Call activation workflow (Sprint 1) if source is a lease
      if (execution.source_type === 'lease') {
        // await this.triggerActivationWorkflow(execution.source_id);
      }

      return {
        success: true,
        execution_id: data.id,
        status: data.status,
        message: 'Execution activated successfully',
        data: data,
      };

    } catch (error) {
      console.error('Activate error:', error);
      return {
        success: false,
        execution_id: executionId,
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // 9. RETURN — Return for changes (unlocks, creates new version)
  // ============================================================

  async returnForChanges(executionId: string, reason: string): Promise<ExecutionResult> {
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

      // Only allow return from sent/viewed/partially_signed states
      if (!['sent', 'viewed', 'partially_signed'].includes(execution.status)) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [`Cannot return: execution is in "${execution.status}" state`],
        };
      }

      // Update execution status to 'declined' (or a "returned" state)
      const { data, error } = await this.supabase
        .from('executions')
        .update({
          status: 'declined' as ExecutionStatus,
          is_locked: false,
          locked_at: null,
          locked_by: null,
        })
        .eq('id', executionId)
        .select()
        .single();

      if (error) {
        console.error('Return error:', error);
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [error.message],
        };
      }

      // Log event
      await logExecutionEvent({
        supabase: this.supabase,
        executionId: executionId,
        eventType: 'returned_for_changes',
        eventData: { reason },
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
        userId: this.userId,
      });

      // TODO: Create new version
      // await this.createNewVersion(executionId);

      return {
        success: true,
        execution_id: data.id,
        status: data.status,
        message: `Execution returned for changes: ${reason}`,
        data: data,
      };

    } catch (error) {
      console.error('Return error:', error);
      return {
        success: false,
        execution_id: executionId,
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // 10. CANCEL — Cancel execution
  // ============================================================

  async cancel(executionId: string, reason: string): Promise<ExecutionResult> {
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

      // Can cancel from most states except executed/activated
      if (['executed', 'activated'].includes(execution.status)) {
        return {
          success: false,
          execution_id: execution.id,
          status: execution.status,
          errors: [`Cannot cancel: execution is already ${execution.status}`],
        };
      }

      const { data, error } = await this.supabase
        .from('executions')
        .update({
          status: 'cancelled' as ExecutionStatus,
          is_locked: false,
          locked_at: null,
          locked_by: null,
        })
        .eq('id', executionId)
        .select()
        .single();

      if (error) {
        console.error('Cancel error:', error);
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
        eventType: 'cancelled',
        eventData: { reason },
        ipAddress: this.ipAddress,
        userAgent: this.userAgent,
        userId: this.userId,
      });

      return {
        success: true,
        execution_id: data.id,
        status: data.status,
        message: `Execution cancelled: ${reason}`,
        data: data,
      };

    } catch (error) {
      console.error('Cancel error:', error);
      return {
        success: false,
        execution_id: executionId,
        status: 'draft',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================
  // 11. POLICY — Get policy for source
  // ============================================================

  async getPolicyForSource(sourceType: SourceType, sourceId: string): Promise<ExecutionPolicy | null> {
    try {
      // Get source to find entity/portfolio
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

      // Find policy for entity
      const { data, error } = await this.supabase
        .from('execution_policies')
        .select('*')
        .eq('entity_id', entityId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error || !data) {
        // Default policy
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
      console.error('Get policy error:', error);
      return null;
    }
  }

  // ============================================================
  // 12. VALIDATION — Check if source exists
  // ============================================================

  private async validateSource(sourceType: SourceType, sourceId: string): Promise<boolean> {
    try {
      const table = sourceType === 'lease' ? 'leases' : 
                     sourceType === 'lease_renewal' ? 'leases' : 
                     'leases'; // Default fallback

      const { data, error } = await this.supabase
        .from(table)
        .select('id')
        .eq('id', sourceId)
        .single();

      if (error || !data) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private async getSourceData(sourceType: SourceType, sourceId: string): Promise<any> {
    try {
      const table = sourceType === 'lease' ? 'leases' : 'leases';

      const { data, error } = await this.supabase
        .from(table)
        .select('*')
        .eq('id', sourceId)
        .single();

      if (error || !data) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }
}

// ============================================================
// Factory function for creating engine instances
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
