/**
 * Observabilidade e logging estruturado para o Sarelli PWA.
 * Centraliza logs de eventos críticos com timestamps e contexto.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  event: string;
  data?: Record<string, any>;
  timestamp: string;
  duration?: number;
}

const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER = 100;

function createEntry(level: LogLevel, event: string, data?: Record<string, any>, duration?: number): LogEntry {
  return {
    level,
    event,
    data,
    timestamp: new Date().toISOString(),
    duration,
  };
}

export const logger = {
  info(event: string, data?: Record<string, any>) {
    const entry = createEntry('info', event, data);
    console.log(`[${entry.timestamp}] ℹ️ ${event}`, data || '');
    pushBuffer(entry);
  },

  warn(event: string, data?: Record<string, any>) {
    const entry = createEntry('warn', event, data);
    console.warn(`[${entry.timestamp}] ⚠️ ${event}`, data || '');
    pushBuffer(entry);
  },

  error(event: string, data?: Record<string, any>) {
    const entry = createEntry('error', event, data);
    console.error(`[${entry.timestamp}] ❌ ${event}`, data || '');
    pushBuffer(entry);
  },

  /** Mede duração de uma operação async */
  async measure<T>(event: string, fn: () => Promise<T>, data?: Record<string, any>): Promise<T> {
    const t0 = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - t0;
      const entry = createEntry('info', event, { ...data, status: 'ok' }, duration);
      console.log(`[${entry.timestamp}] ⏱️ ${event} (${duration.toFixed(0)}ms)`, data || '');
      pushBuffer(entry);
      return result;
    } catch (err: any) {
      const duration = performance.now() - t0;
      const entry = createEntry('error', event, { ...data, error: err.message }, duration);
      console.error(`[${entry.timestamp}] ⏱️ ${event} FAILED (${duration.toFixed(0)}ms)`, err.message);
      pushBuffer(entry);
      throw err;
    }
  },

  /** Retorna últimos N logs (para debug no console) */
  getRecent(n = 20): LogEntry[] {
    return LOG_BUFFER.slice(-n);
  },

  /** Reporta Web Vitals básicos */
  reportWebVitals() {
    if ('performance' in window) {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (nav) {
        logger.info('web-vitals:navigation', {
          dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
          tcp: Math.round(nav.connectEnd - nav.connectStart),
          ttfb: Math.round(nav.responseStart - nav.requestStart),
          domReady: Math.round(nav.domContentLoadedEventEnd - nav.fetchStart),
          load: Math.round(nav.loadEventEnd - nav.fetchStart),
        });
      }
    }
  },
};

function pushBuffer(entry: LogEntry) {
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();
}

// Exporta para acesso global no console: window.__sarelliLogs
if (typeof window !== 'undefined') {
  (window as any).__sarelliLogs = () => logger.getRecent(50);
  // Reporta vitals após load
  window.addEventListener('load', () => {
    setTimeout(() => logger.reportWebVitals(), 2000);
  });
}
