// lib/conversation/index.ts
// Conversation Exports

export * from './engine';
export * from './event-bus';
export * from './intent-registry';
export * from './state-machine';
export * from './workflow-orchestrator';

// Export context functions individually
export { 
  getOrCreateContext, 
  updateContext, 
  closeContext, 
  addToHistory 
} from './context';

export type { ConversationContext } from './context';
