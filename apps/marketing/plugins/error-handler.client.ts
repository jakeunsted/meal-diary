export default defineNuxtPlugin((nuxtApp) => {
  if (!process.client) return;

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Marketing Error Handler] Unhandled promise rejection:', event.reason);

    const reason = event.reason;
    const message = reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'unknown';

    try {
      (nuxtApp.$posthog as { logger?: { error: (body: string, attributes?: Record<string, unknown>) => void } })
        ?.logger
        ?.error('Unhandled promise rejection', {
          reason: message.slice(0, 200),
          surface: 'marketing',
        });
    } catch {
      /* ignore */
    }
  });

  nuxtApp.vueApp.config.errorHandler = (err, _instance, info) => {
    console.error('[Marketing Error Handler] Vue error:', err, info);
    const message = err instanceof Error ? err.message : String(err);
    try {
      (nuxtApp.$posthog as { logger?: { error: (body: string, attributes?: Record<string, unknown>) => void } })
        ?.logger
        ?.error('Vue error', {
          reason: message.slice(0, 200),
          info: String(info).slice(0, 100),
          surface: 'marketing',
        });
    } catch {
      /* ignore */
    }
  };
});
