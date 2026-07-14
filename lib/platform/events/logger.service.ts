// lib/platform/events/logger.service.ts
// Logger Abstraction

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

class ConsoleLogger implements ILogger {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel) {
    this.level = level;
  }

  debug(message: string, meta?: Record<string, any>) {
    if (this.level === 'debug') console.debug(`[DEBUG] ${message}`, meta || '');
  }

  info(message: string, meta?: Record<string, any>) {
    console.log(`[INFO] ${message}`, meta || '');
  }

  warn(message: string, meta?: Record<string, any>) {
    console.warn(`[WARN] ${message}`, meta || '');
  }

  error(message: string, meta?: Record<string, any>) {
    console.error(`[ERROR] ${message}`, meta || '');
  }
}

export const logger = new ConsoleLogger();
