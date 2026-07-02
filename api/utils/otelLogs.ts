import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import type { Request } from 'express';
import { toLogAttributes } from '@meal-diary/shared';
import { getDistinctId } from './posthog.ts';

let sdk: NodeSDK | null = null;
let initialized = false;

const SERVICE_NAME = 'meal-diary-api';

const getPostHogLogsUrl = (): string | null => {
  const apiKey = process.env.POSTHOG_KEY;
  if (!apiKey) {
    return null;
  }

  const host = (process.env.POSTHOG_HOST || 'https://eu.i.posthog.com').replace(/\/$/, '');
  return `${host}/i/v1/logs`;
};

/**
 * Initialise OpenTelemetry log export to PostHog Logs.
 * @see https://posthog.com/docs/logs/installation/nodejs
 */
export const initializeOtelLogs = (): void => {
  if (initialized) {
    return;
  }

  const logsUrl = getPostHogLogsUrl();
  const apiKey = process.env.POSTHOG_KEY;
  if (!logsUrl || !apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('PostHog Logs: POSTHOG_KEY not set — auth logs will not be exported');
    }
    return;
  }

  try {
    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        'service.name': SERVICE_NAME,
      }),
      logRecordProcessor: new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: logsUrl,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })
      ),
    });

    sdk.start();
    initialized = true;

    if (process.env.NODE_ENV !== 'production') {
      console.log(`PostHog Logs: OpenTelemetry exporter initialised (${logsUrl})`);
    }
  } catch (err) {
    console.error('PostHog Logs: Failed to initialise OpenTelemetry:', err);
  }
};

export const shutdownOtelLogs = async (): Promise<void> => {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    initialized = false;
  }
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
  if (!initialized) {
    return;
  }

  const logger = logs.getLogger('meal-diary-auth');
  const attributes = toLogAttributes(properties);

  logger.emit({
    severityText: severity,
    body,
    attributes: {
      posthogDistinctId: getDistinctId(req),
      category: 'auth',
      source: 'backend',
      ...attributes,
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
