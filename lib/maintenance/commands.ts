// lib/maintenance/commands.ts — Write operations only
import { maintenanceEngine } from './engine';

export const createIssue = maintenanceEngine.createIssue.bind(maintenanceEngine);
export const classifyIssue = maintenanceEngine.classifyIssue.bind(maintenanceEngine);
export const createWorkOrder = maintenanceEngine.createWorkOrder.bind(maintenanceEngine);
export const matchSupplier = maintenanceEngine.matchSupplier.bind(maintenanceEngine);
export const scheduleVisit = maintenanceEngine.scheduleVisit.bind(maintenanceEngine);
export const completeWork = maintenanceEngine.completeWork.bind(maintenanceEngine);
export const requestApproval = maintenanceEngine.requestApproval.bind(maintenanceEngine);
export const requestQuotes = maintenanceEngine.requestQuotes.bind(maintenanceEngine);
export const approveQuote = maintenanceEngine.approveQuote.bind(maintenanceEngine);
