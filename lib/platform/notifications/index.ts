// lib/platform/notifications/index.ts

export * from './types';
export * from './engine';
export * from './templates';
export * from './preferences';
export * from './channels';

// Import handlers to register event subscriptions
import './handlers';

// Initialize notification engine
import { notificationEngine } from './engine';
notificationEngine.initialize();
