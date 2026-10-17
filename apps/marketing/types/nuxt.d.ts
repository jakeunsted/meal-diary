interface MarketingPostHogApi {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  track: (event: string, properties?: Record<string, unknown>) => void;
  logger: {
    info: (body: string, attributes?: Record<string, unknown>) => void;
    warn: (body: string, attributes?: Record<string, unknown>) => void;
    error: (body: string, attributes?: Record<string, unknown>) => void;
  };
}

declare module '#app' {
  interface NuxtApp {
    $posthog: MarketingPostHogApi;
    $openCookiePreferences?: () => void;
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $posthog: MarketingPostHogApi;
    $openCookiePreferences?: () => void;
  }
}

export {};
