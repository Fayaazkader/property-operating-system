// lib/platform/validation/registry.ts
// Validation Registry — Register all domain rules

import { validationEngine } from './engine';
import { leaseRules, supplierRules, workOrderRules } from './rules';

// Register all domain rules
validationEngine.registerRules('lease', leaseRules);
validationEngine.registerRules('supplier', supplierRules);
validationEngine.registerRules('work_order', workOrderRules);

// Future domains:
// validationEngine.registerRules('broker', brokerRules);
// validationEngine.registerRules('tenant', tenantRules);
// validationEngine.registerRules('payment', paymentRules);

console.log('✅ Validation rules registered');
