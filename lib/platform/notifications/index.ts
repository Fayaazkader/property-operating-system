// lib/platform/notifications/index.ts

export * from './types';
export * from './engine';
export * from './templates';
export * from './preferences';
export * from './channels';

// Initialize notification engine when imported
import { notificationEngine } from './engine';
notificationEngine.initialize();
