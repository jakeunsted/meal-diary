import { initializeOtelLogs } from '../utils/otelLogs';

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();

  initializeOtelLogs({
    apiKey: config.posthogKey as string,
    host: (config.posthogHost as string) || 'https://eu.i.posthog.com',
    serviceName: 'meal-diary-frontend',
  });
});
