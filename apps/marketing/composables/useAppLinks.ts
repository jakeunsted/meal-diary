/**
 * Builds outbound product-app URLs with marketing UTMs.
 * Preserves inbound UTMs from the current page when present.
 */

interface UtmOptions {
  campaign: string;
  content?: string;
  medium?: string;
  source?: string;
}

function readInboundUtms(): Record<string, string> {
  if (!process.client || typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const inbound: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = params.get(key);
    if (value) inbound[key] = value;
  }
  return inbound;
}

function withUtms(baseUrl: string, options: UtmOptions): string {
  const url = new URL(baseUrl);
  const inbound = readInboundUtms();

  // Preserve inbound UTMs; fill gaps with marketing defaults
  const merged: Record<string, string> = {
    utm_source: options.source || 'marketing',
    utm_medium: options.medium || 'site',
    utm_campaign: options.campaign,
    ...inbound,
  };
  if (options.content && !merged.utm_content) {
    merged.utm_content = options.content;
  }

  for (const [key, value] of Object.entries(merged)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export const useAppLinks = () => {
  const config = useRuntimeConfig();
  const appUrl = (config.public.appUrl as string) || 'https://app.mealdiary.co.uk';
  const plansUrl = (config.public.plansUrl as string) || `${appUrl}/plans`;
  const privacyUrl = (config.public.privacyUrl as string) || `${appUrl}/privacy`;
  const termsUrl = (config.public.termsUrl as string) || `${appUrl}/terms`;

  const webAppUrl = (campaign: string, content?: string) =>
    withUtms(appUrl, { campaign, content });

  const plansLink = (campaign = 'pricing', content?: string) =>
    withUtms(plansUrl, { campaign, content });

  return {
    appUrl,
    plansUrl,
    privacyUrl,
    termsUrl,
    webAppUrl,
    plansLink,
  };
};
