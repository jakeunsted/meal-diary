import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import type { Request } from 'express';
import { toLogAttributes } from '@meal-diary/shared';
import { getDistinctId } from './posthog.ts';

let loggerProvider: LoggerProvider | null = null;
let initialized = false;

const SERVICE_NAME = 'meal-diary-api';
const SERVICE_VERSION = '1.0.0';
const POSTHOG_LOGS_URL = 'https://eu.i.posthog.com/i/v1/logs';

export interface EmitLogOptions {
  severity: 'error' | 'warn' | 'info';
  body: string;
  attributes?: Record<string, unknown>;
  loggerName?: string;
  req?: Request;
}

/**
 * Initialise OpenTelemetry log export to PostHog Logs.
 * Always sends to EU ingest — do not route OTLP through the prxhg reverse proxy.
 * @see https://posthog.com/docs/logs/installation/nodejs
 */
export const initializeOtelLogs = (): void => {
  if (initialized) {
    return;
  }

  const apiKey = process.env.POSTHOG_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('PostHog Logs: POSTHOG_KEY not set — logs will not be exported');
    }
    return;
  }

  try {
    loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({
        'service.name': SERVICE_NAME,
        'service.version': SERVICE_VERSION,
        'deployment.environment': process.env.NODE_ENV || 'development',
      }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: POSTHOG_LOGS_URL,
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }),
        }),
      ],
    });
    logs.setGlobalLoggerProvider(loggerProvider);
    initialized = true;

    emitLog({
      severity: 'info',
      body: 'OpenTelemetry log exporter started',
      attributes: { category: 'startup' },
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`PostHog Logs: OpenTelemetry exporter initialised (${POSTHOG_LOGS_URL})`);
    }
  } catch (err) {
    console.error('PostHog Logs: Failed to initialise OpenTelemetry:', err);
  }
};

export const shutdownOtelLogs = async (): Promise<void> => {
  if (loggerProvider) {
    await loggerProvider.shutdown();
    loggerProvider = null;
    initialized = false;
  }
};

export const emitLog = ({
  severity,
  body,
  attributes,
  loggerName,
  req,
}: EmitLogOptions): void => {
  if (!initialized) {
    return;
  }

  const logger = logs.getLogger(loggerName ?? SERVICE_NAME);
  const logAttributes = toLogAttributes(attributes);

  logger.emit({
    severityText: severity,
    body,
    attributes: {
      source: 'backend',
      ...(req ? { posthogDistinctId: getDistinctId(req) } : {}),
      ...logAttributes,
    },
  });
};

/**
 * Emit an auth log to PostHog Logs via OpenTelemetry.
 * Includes posthogDistinctId for person linking; pass sessionId when available for replay linking.
 */
export const logAuth = (
  req: Request,
  severity: 'error' | 'warn' | 'info',
  body: string,
  properties?: Record<string, unknown>
): void => {
  emitLog({
    severity,
    body,
    req,
    loggerName: 'meal-diary-auth',
    attributes: {
      category: 'auth',
      ...properties,
    },
  });
};

/**
 * Auth failure/success diagnostic logging to PostHog Logs.
 */
export const trackAuthLog = async (
  req: Request,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> => {
  logAuth(req, 'error', event, {
    event,
    ...properties,
  });
};
