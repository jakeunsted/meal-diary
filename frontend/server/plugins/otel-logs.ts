import { initializeOtelLogs, shutdownOtelLogs } from '../utils/otelLogs';

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig();

  initializeOtelLogs({
    apiKey: config.posthogKey as string,
    serviceName: 'meal-diary-frontend',
  });

  nitroApp.hooks.hook('close', async () => {
    await shutdownOtelLogs();
  });
});
