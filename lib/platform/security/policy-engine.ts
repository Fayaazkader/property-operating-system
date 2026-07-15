// lib/platform/security/policy-engine.ts
// Policy Engine — Evaluates rules and returns warnings/approvals

import { settingsEngine } from "../settings/engine";
import { ApprovalCondition, ApprovalStep } from "../settings/types";
import { logger } from "../events/logger.service";

export interface PolicyResult {
  passed: boolean;
  warnings: string[];
  requires_approval: boolean;
  approval_workflow?: ApprovalStep[];
  blocking: boolean;
  reason?: string;
}

export class PolicyEngine {
  async evaluate(
    entityId: string,
    entityType: string,
    action: string,
    data: Record<string, any>
  ): Promise<PolicyResult> {
    const settings = await settingsEngine.getSettings(entityId);
    const policies = settings.approval_policies.filter(p => 
      p.entity_type === entityType && 
      p.action === action && 
      p.is_active
    );

    const warnings: string[] = [];
    let requiresApproval = false;
    let approvalWorkflow: ApprovalStep[] = [];
    let blocking = false;

    for (const policy of policies) {
      const conditionsMet = this.evaluateConditions(data, policy.conditions);
      
      if (conditionsMet) {
        if (policy.approvers.length > 0) {
          requiresApproval = true;
          approvalWorkflow = policy.approvers;
        } else {
          warnings.push(`Policy "${policy.name}" requires attention`);
        }
        break;
      }
    }

    return {
      passed: true,
      warnings,
      requires_approval: requiresApproval,
      approval_workflow: approvalWorkflow,
      blocking: requiresApproval,
    };
  }

  private evaluateConditions(data: Record<string, any>, conditions: ApprovalCondition[]): boolean {
    for (const condition of conditions) {
      const value = data[condition.field];
      
      switch (condition.operator) {
        case 'eq':
          if (value !== condition.value) return false;
          break;
        case 'neq':
          if (value === condition.value) return false;
          break;
        case 'gt':
          if (!(value > condition.value)) return false;
          break;
        case 'gte':
          if (!(value >= condition.value)) return false;
          break;
        case 'lt':
          if (!(value < condition.value)) return false;
          break;
        case 'lte':
          if (!(value <= condition.value)) return false;
          break;
        case 'contains':
          if (!String(value).includes(String(condition.value))) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false;
          break;
        default:
          return false;
      }
    }
    return true;
  }
}

export const policyEngine = new PolicyEngine();
