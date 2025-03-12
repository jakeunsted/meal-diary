/**
 * Custom fetch export to use baseUrl from .env and return json
 * @param path - The path to fetch
 * @param options - The options to fetch
 * @returns The response from the fetch
 */
export async function apiFetch(path: string, options: RequestInit = { method: 'GET' }): Promise<Response> {
  const config = useRuntimeConfig();
  const baseUrl = config.public.baseUrl;
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, options);
  return response.json();
};
