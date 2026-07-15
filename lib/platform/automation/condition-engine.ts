// lib/platform/automation/condition-engine.ts
// Condition Engine — Evaluates automation conditions

import type { AutomationCondition, ConditionResult } from './types';

export class ConditionEngine {
  evaluate(conditions: AutomationCondition[], payload: Record<string, any>): ConditionResult[] {
    if (!conditions || conditions.length === 0) {
      return [{ passed: true, field: 'none', operator: 'exists', expected: true, actual: true }];
    }
    return conditions.map(c => this.evaluateSingle(c, payload));
  }

  private evaluateSingle(condition: AutomationCondition, payload: Record<string, any>): ConditionResult {
    const actual = this.resolveField(condition.field, payload);
    const expected = condition.value;
    let passed = false;

    switch (condition.operator) {
      case 'equals': passed = actual === expected; break;
      case 'not_equals': passed = actual !== expected; break;
      case 'greater_than': passed = Number(actual) > Number(expected); break;
      case 'less_than': passed = Number(actual) < Number(expected); break;
      case 'contains': passed = String(actual).includes(String(expected)); break;
      case 'in': passed = Array.isArray(expected) && expected.includes(actual); break;
      case 'not_in': passed = Array.isArray(expected) && !expected.includes(actual); break;
      case 'exists': passed = actual !== undefined && actual !== null; break;
      case 'not_exists': passed = actual === undefined || actual === null; break;
    }

    return { passed, field: condition.field, operator: condition.operator, expected, actual };
  }

  private resolveField(field: string, payload: Record<string, any>): any {
    const parts = field.split('.');
    let value: any = payload;
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }
    return value;
  }

  allPassed(results: ConditionResult[]): boolean {
    return results.every(r => r.passed);
  }
}

export const conditionEngine = new ConditionEngine();
