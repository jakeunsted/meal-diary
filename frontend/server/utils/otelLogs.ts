import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { toLogAttributes } from '@meal-diary/shared';

let loggerProvider: LoggerProvider | null = null;
let initialized = false;

const POSTHOG_LOGS_URL = 'https://eu.i.posthog.com/i/v1/logs';
const SERVICE_VERSION = '1.0.0';

interface OtelLogsConfig {
  apiKey: string;
  serviceName: string;
}

export interface EmitLogOptions {
  severity: 'error' | 'warn' | 'info';
  body: string;
  attributes?: Record<string, unknown>;
  loggerName?: string;
  distinctId?: string;
}

export const initializeOtelLogs = (config: OtelLogsConfig): void => {
  if (initialized || !config.apiKey) {
    return;
  }

  try {
    loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({
        'service.name': config.serviceName,
        'service.version': SERVICE_VERSION,
        'deployment.environment': process.env.NODE_ENV || 'development',
      }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: POSTHOG_LOGS_URL,
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
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
      loggerName: config.serviceName,
    });
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

export const flushOtelLogs = async (): Promise<void> => {
  if (loggerProvider) {
    await loggerProvider.forceFlush();
  }
};

export const emitLog = ({
  severity,
  body,
  attributes,
  loggerName,
  distinctId,
}: EmitLogOptions): void => {
  if (!initialized) {
    return;
  }

  const logger = logs.getLogger(loggerName ?? 'meal-diary-frontend');
  const logAttributes = toLogAttributes(attributes);

  logger.emit({
    severityText: severity,
    body,
    attributes: {
      source: 'frontend_server',
      ...(distinctId ? { posthogDistinctId: distinctId } : {}),
      ...logAttributes,
    },
  });
};

export const logAuthError = (
  distinctId: string,
  body: string,
  properties?: Record<string, unknown>
): void => {
  if (!distinctId) {
    return;
  }

  emitLog({
    severity: 'error',
    body,
    distinctId,
    loggerName: 'meal-diary-auth',
    attributes: {
      category: 'auth',
      ...properties,
    },
  });
};
