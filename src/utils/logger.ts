/**
 * @file src/utils/logger.ts
 * @description Structured logging utility for ResQ.
 *
 * Replaces all direct `console.*` calls throughout the codebase.
 * Log output is controlled by the `VITE_LOG_LEVEL` environment variable:
 * - `debug`  → logs everything (debug, info, warn, error)
 * - `info`   → logs info, warn, error (default in development)
 * - `warn`   → logs warn, error only
 * - `error`  → logs only errors (recommended for production)
 * - `silent` → suppresses all output
 *
 * @example
 * ```ts
 * import { logger } from '@utils/logger';
 * logger.info('Agent initialized');
 * logger.error('Gemini API call failed', error);
 * ```
 */

/** Supported log level names */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** Numeric rank for log level comparison */
const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * Reads the configured minimum log level from the Vite environment variable.
 * Falls back to 'info' if not set or unrecognized.
 */
function getConfiguredLevel(): LogLevel {
  const envLevel = import.meta.env.VITE_LOG_LEVEL as string | undefined;
  const valid: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
  if (envLevel && valid.includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }
  return import.meta.env.PROD ? 'warn' : 'info';
}

/**
 * Formats a log message with a timestamp prefix and optional module tag.
 * @param level - The log level string
 * @param module - Optional module identifier for scoping
 * @param message - The main log message
 */
function formatMessage(level: LogLevel, module: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [ResQ/${module.toUpperCase()}] [${level.toUpperCase()}] ${message}`;
}

/**
 * Factory that creates a namespaced logger instance for a specific module.
 * @param module - Human-readable module name (e.g. 'GeminiService', 'Agent')
 */
function createLogger(module: string) {
  const shouldLog = (level: LogLevel): boolean => {
    const configuredLevel = getConfiguredLevel();
    return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[configuredLevel];
  };

  return {
    /**
     * Logs a debug-level message. Only visible when VITE_LOG_LEVEL=debug.
     * Use for granular trace-level information during development.
     */
    debug(message: string, ...args: unknown[]): void {
      if (shouldLog('debug')) {
        // eslint-disable-next-line no-console
        console.debug(formatMessage('debug', module, message), ...args);
      }
    },

    /**
     * Logs an informational message about normal system operation.
     * Use for state transitions, successful operations, and lifecycle events.
     */
    info(message: string, ...args: unknown[]): void {
      if (shouldLog('info')) {
        // eslint-disable-next-line no-console
        console.info(formatMessage('info', module, message), ...args);
      }
    },

    /**
     * Logs a warning about a recoverable issue or unexpected but non-fatal condition.
     * Use when falling back to defaults or when inputs are marginally invalid.
     */
    warn(message: string, ...args: unknown[]): void {
      if (shouldLog('warn')) {
        // eslint-disable-next-line no-console
        console.warn(formatMessage('warn', module, message), ...args);
      }
    },

    /**
     * Logs an error. Use for failures that interrupt normal operation.
     * Always include the original error object as a second argument.
     */
    error(message: string, ...args: unknown[]): void {
      if (shouldLog('error')) {
        // eslint-disable-next-line no-console
        console.error(formatMessage('error', module, message), ...args);
      }
    },
  };
}

/**
 * Default application-level logger. Use module-specific loggers for better tracing.
 * @example logger.info('App started');
 */
export const logger = createLogger('App');

/**
 * Creates a named logger scoped to a specific module.
 * @param moduleName - The module identifier to prefix log lines with
 * @returns A logger instance bound to the given module name
 * @example
 * ```ts
 * const log = createModuleLogger('GeminiService');
 * log.info('Calling Vision API...');
 * ```
 */
export const createModuleLogger = createLogger;
