import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { toLogAttributes } from '@meal-diary/shared';

let sdk: NodeSDK | null = null;
let initialized = false;

interface OtelLogsConfig {
  apiKey: string;
  host: string;
  serviceName: string;
}

const getPostHogLogsUrl = (host: string): string => {
  const base = host.replace(/\/$/, '');
  return `${base}/i/v1/logs`;
};

export const initializeOtelLogs = (config: OtelLogsConfig): void => {
  if (initialized || !config.apiKey) {
    return;
  }

  const logsUrl = getPostHogLogsUrl(config.host);

  try {
    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        'service.name': config.serviceName,
      }),
      logRecordProcessor: new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: logsUrl,
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
          },
        })
      ),
    });

    sdk.start();
    initialized = true;
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

export const logAuthError = (
  distinctId: string,
  body: string,
  properties?: Record<string, unknown>
): void => {
  if (!initialized || !distinctId) {
    return;
  }

  const logger = logs.getLogger('meal-diary-auth');
  const attributes = toLogAttributes(properties);

  logger.emit({
    severityText: 'error',
    body,
    attributes: {
      posthogDistinctId: distinctId,
      category: 'auth',
      source: 'frontend_server',
      ...attributes,
    },
  });
};
