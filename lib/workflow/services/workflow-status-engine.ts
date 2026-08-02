// lib/workflow/services/workflow-status-engine.ts
// Consistent state model for every governed workflow in AssetFlow

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';

export type WorkflowType = 'lease_activation' | 'initial_billing' | 'recurring_billing' | 'statement_close' | 'financial_close';

export type WorkflowStatus = 'pending' | 'in_progress' | 'awaiting_approval' | 'approved' | 'completed' | 'failed';

export interface WorkflowState {
  id: string;
  entity_id: string;
  workflow_type: WorkflowType;
  reference_type: string;
  reference_id: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  label: string;
  status: WorkflowStatus;
  completed_at?: string;
  actor_id?: string;
}

export class WorkflowStatusEngine {
  async create(workflowType: WorkflowType, entityId: string, referenceType: string, referenceId: string, steps: string[]): Promise<WorkflowState> {
    const workflowSteps: WorkflowStep[] = steps.map((label, i) => ({
      id: crypto.randomUUID(),
      label,
      status: i === 0 ? 'in_progress' : 'pending',
    }));

    const state: WorkflowState = {
      id: crypto.randomUUID(),
      entity_id: entityId,
      workflow_type: workflowType,
      reference_type: referenceType,
      reference_id: referenceId,
      status: 'in_progress',
      steps: workflowSteps,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase.from('workflow_states').insert(state);

    await publish('workflow.created', {
      correlationId: crypto.randomUUID(),
      source: 'workflow-status-engine',
      version: '1.0',
      payload: state,
    });

    return state;
  }

  async advanceStep(workflowId: string, stepLabel: string, actorId?: string): Promise<void> {
    const { data: state } = await supabase.from('workflow_states').select('*').eq('id', workflowId).single();
    if (!state) return;

    const steps = state.steps.map((s: WorkflowStep) => {
      if (s.label === stepLabel) return { ...s, status: 'completed' as WorkflowStatus, completed_at: new Date().toISOString(), actor_id: actorId };
      if (s.status === 'in_progress') return { ...s, status: 'completed' as WorkflowStatus };
      return s;
    });

    // Set next step to in_progress
    const nextStep = steps.find((s: WorkflowStep) => s.status === 'pending');
    if (nextStep) nextStep.status = 'in_progress';

    const allDone = steps.every((s: WorkflowStep) => s.status === 'completed');
    const newStatus: WorkflowStatus = allDone ? 'completed' : state.status;

    await supabase.from('workflow_states').update({ steps, status: newStatus, updated_at: new Date().toISOString() }).eq('id', workflowId);

    await publish('workflow.step_completed', {
      correlationId: crypto.randomUUID(),
      source: 'workflow-status-engine',
      version: '1.0',
      payload: { workflowId, stepLabel, actorId },
    });
  }

  async getPending(entityId: string, workflowType?: WorkflowType): Promise<WorkflowState[]> {
    let query = supabase.from('workflow_states').select('*').eq('entity_id', entityId).neq('status', 'completed');
    if (workflowType) query = query.eq('workflow_type', workflowType);
    const { data } = await query.order('created_at', { ascending: false });
    return data || [];
  }
}

export const workflowStatusEngine = new WorkflowStatusEngine();
