/**
 * Consent-independent auth error reporting via Nuxt server route.
 * Used for OAuth/login failures before analytics consent is granted.
 */
export const useAuthAnalytics = () => {
  const getPostHogSessionId = (): string | undefined => {
    if (!import.meta.client) {
      return undefined;
    }

    try {
      const posthogModule = (window as { posthog?: { getSessionId?: () => string } }).posthog;
      if (posthogModule && typeof posthogModule.getSessionId === 'function') {
        return posthogModule.getSessionId();
      }
    } catch {
      /* ignore */
    }

    return undefined;
  };

  const reportAuthError = (
    event: string,
    properties?: Record<string, string | undefined>
  ): void => {
    if (!import.meta.client) {
      return;
    }

    const sessionId = getPostHogSessionId();
    const payload: Record<string, string> = {};

    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        if (value !== undefined && value !== '') {
          payload[key] = value;
        }
      }
    }

    if (sessionId) {
      payload.session_id = sessionId;
    }

    $fetch('/api/analytics/auth-event', {
      method: 'POST',
      body: {
        event,
        properties: payload,
      },
    }).catch(() => {
      /* auth flows must never break on analytics */
    });
  };

  return { reportAuthError };
};
