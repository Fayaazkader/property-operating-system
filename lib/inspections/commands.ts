// lib/inspections/commands.ts — Write operations only
import { inspectionsEngine } from './engine';

export const createInspection = inspectionsEngine.create.bind(inspectionsEngine);
export const completeInspection = inspectionsEngine.complete.bind(inspectionsEngine);
