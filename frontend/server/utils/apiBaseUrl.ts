/**
 * Base URL for server-side requests to the Express API.
 * Uses API_INTERNAL_URL in Docker; falls back to public BASE_URL locally.
 */
export function getApiBaseUrl(): string {
  const config = useRuntimeConfig();
  const internal = config.apiInternalUrl as string | undefined;
  const base = (internal?.trim() || (config.public.baseUrl as string)).replace(/\/$/, '');
  return base;
}
