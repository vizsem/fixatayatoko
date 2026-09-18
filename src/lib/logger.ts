/**
 * Production-safe logger utility.
 * - In development: outputs to console (with color coding)
 * - In production: suppresses debug/info logs, sends errors to Sentry
 *
 * Usage:
 *   import logger from '@/lib/logger';
 *   logger.info('Stok disinkronisasi');
 *   logger.warn('Koneksi lambat');
 *   logger.error('Gagal transaksi', err);
 */

import * as Sentry from '@sentry/nextjs';

const isDev = process.env.NODE_ENV === 'development';

const logger = {
  /**
   * Informational logs — only visible in development.
   */
  info(...args: any[]) {
    if (isDev) console.info('[INFO]', ...args);
  },

  /**
   * Debug logs — only visible in development.
   */
  debug(...args: any[]) {
    if (isDev) console.debug('[DEBUG]', ...args);
  },

  /**
   * Warnings — visible in development, sent to Sentry in production.
   */
  warn(...args: any[]) {
    if (isDev) {
      console.warn('[WARN]', ...args);
    } else {
      Sentry.addBreadcrumb({ category: 'warn', message: String(args[0]), data: args.slice(1) });
    }
  },

  /**
   * Errors — always logged, also sent to Sentry in production.
   */
  error(message: string, error?: unknown, extra?: Record<string, unknown>) {
    if (isDev) {
      console.error('[ERROR]', message, error);
    } else {
      Sentry.captureException(error instanceof Error ? error : new Error(message), {
        extra: { message, ...(extra || {}) },
      });
    }
  },
};

export default logger;
