/**
 * Custom fetch export to use baseUrl from .env and return json
 * @param path - The path to fetch
 * @param options - The options to fetch
 * @returns The response from the fetch
 */
interface ApiFetchOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
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

  console.log(finalUrl);

  const { query, ...fetchOptions } = options;

  if (fetchOptions.method === 'POST' || fetchOptions.method === 'PUT' || fetchOptions.method === 'PATCH') {
    fetchOptions.headers = {
      'Content-Type': 'application/json',
    };
  }

  const response = await fetch(finalUrl, fetchOptions);
  return response.json();
}
