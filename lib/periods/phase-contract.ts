// lib/periods/phase-contract.ts
// Governance contract: status and workflow_phase are separate concerns

/**
 * STATUS — Lifecycle of the period itself
 * - 'open'   = Period is active, postings allowed
 * - 'closed' = Period is frozen, no postings allowed
 * 
 * WORKFLOW_PHASE — Operational progress while status = 'open'
 * Only valid when status = 'open'. Must be null when status = 'closed'.
 * 
 * Valid combinations:
 *   status=open,  workflow_phase=open
 *   status=open,  workflow_phase=receipting
 *   status=open,  workflow_phase=allocation
 *   status=open,  workflow_phase=billing_requested
 *   status=open,  workflow_phase=billing_running
 *   status=open,  workflow_phase=billing_complete
 *   status=open,  workflow_phase=exception_review
 *   status=open,  workflow_phase=ready_to_close
 *   status=closed, workflow_phase=closed
 * 
 * INVALID combinations (enforced by this contract):
 *   status=closed, workflow_phase=billing_running  ← Contradiction
 *   status=open,   workflow_phase=closed           ← Contradiction
 */

export const VALID_PHASES_FOR_OPEN = [
  'open', 'receipting', 'allocation', 'billing_requested', 'billing_running',
  'billing_complete', 'exception_review', 'ready_to_close',
] as const;

export const VALID_PHASES_FOR_CLOSED = ['closed'] as const;

export function isValidPhaseCombination(status: string, workflowPhase: string | null): boolean {
  if (status === 'open' && workflowPhase && VALID_PHASES_FOR_OPEN.includes(workflowPhase as any)) return true;
  if (status === 'closed' && (!workflowPhase || VALID_PHASES_FOR_CLOSED.includes(workflowPhase as any))) return true;
  return false;
}

export function getDefaultPhaseForStatus(status: string): string {
  return status === 'open' ? 'open' : 'closed';
}
