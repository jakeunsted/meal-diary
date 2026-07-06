import { env } from '@/constants/env';

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const url = `${env.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
