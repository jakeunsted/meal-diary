/**
 * Consent-gated marketing_* event helpers.
 * Navigation always works; only capture is gated on Analytics consent.
 */

export const useMarketingAnalytics = () => {
  const { $posthog } = useNuxtApp();

  const track = (event: string, properties?: Record<string, unknown>) => {
    try {
      ($posthog as { track?: (e: string, p?: Record<string, unknown>) => void })
        ?.track?.(event, properties);
    } catch {
      /* ignore */
    }
  };

  const trackNavClick = (navItem: string) => {
    track('marketing_nav_click', { nav_item: navItem });
  };

  const trackWebAppCta = (placement: string) => {
    track('marketing_cta_web_app', { placement });
  };

  const trackPlansCta = (placement = 'pricing') => {
    track('marketing_cta_plans', { placement });
  };

  const trackIosComingSoon = (placement: string) => {
    track('marketing_cta_ios_coming_soon', { placement });
  };

  const trackAndroidComingSoon = (placement: string) => {
    track('marketing_cta_android_coming_soon', { placement });
  };

  const trackFaqOpen = (questionId: string) => {
    track('marketing_faq_open', { question_id: questionId });
  };

  return {
    track,
    trackNavClick,
    trackWebAppCta,
    trackPlansCta,
    trackIosComingSoon,
    trackAndroidComingSoon,
    trackFaqOpen,
  };
};
