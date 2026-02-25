import { H3Event } from 'h3';

/**
 * Custom fetch export to use baseUrl from .env and return json.
 * Token refresh is handled exclusively by the client (useApi composable)
 * to avoid race conditions between server-side and client-side refresh.
 * @param path - The path to fetch
 * @param options - The options to fetch
 * @returns The response from the fetch
 */
interface ApiFetchOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T = any>(path: string, options: ApiFetchOptions = {}, event?: H3Event): Promise<T> {
  const config = useRuntimeConfig();
  const baseUrl = config.public.baseUrl;
  let finalUrl = `${baseUrl}${path}`;

  if (options.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + params.toString();
  }

  const { query, ...fetchOptions } = options;

  if (fetchOptions.method === 'POST' || fetchOptions.method === 'PUT' || fetchOptions.method === 'PATCH') {
    fetchOptions.headers = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };
  }

  // Forward auth headers from the incoming request to the API as-is
  if (event) {
    const authHeader = getHeader(event, 'authorization');
    const refreshToken = getHeader(event, 'x-refresh-token');

    if (authHeader) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Authorization': authHeader,
      };
    }

    if (refreshToken) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'x-refresh-token': refreshToken,
      };
    }
  }

  const response = await fetch(finalUrl, fetchOptions);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw {
      statusCode: response.status,
      message: error.message || `API error: ${response.statusText}`
    };
  }

  return response.json();
}
