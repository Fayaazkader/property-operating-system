// lib/platform/validation/register.ts
// Register all validation rules

import { validationEngine } from './engine';

// Register lease rules
validationEngine.registerRules('lease', validationEngine.getLeaseValidationRules());

// Register supplier rules
validationEngine.registerRules('supplier', validationEngine.getSupplierValidationRules());

// Register work order rules
validationEngine.registerRules('work_order', validationEngine.getWorkOrderValidationRules());

console.log('✅ Validation rules registered');
