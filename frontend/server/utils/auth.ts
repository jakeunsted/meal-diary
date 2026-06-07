import { H3Event } from 'h3';
import type { TokenResponse } from '~/types/Auth';
import type { ApiResponse } from '~/types/Api';
import { isTokenExpired } from './jwt';
import { getApiBaseUrl } from '~/server/utils/apiBaseUrl';
import {
  toApiHttpError,
  getHttpStatusCode,
  AUTH_RETRY_MESSAGE,
} from '~/utils/httpError';

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const refreshResponse = await fetch(`${getApiBaseUrl()}/auth/refresh-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!refreshResponse.ok) {
    const errorData = await refreshResponse.json().catch(() => ({ message: 'Failed to refresh token' }));
    throw {
      statusCode: refreshResponse.status,
      message: errorData.message || 'Failed to refresh token',
    };
  }

  return refreshResponse.json() as Promise<TokenResponse>;
}

export async function authenticatedFetch<T>(
  event: H3Event,
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const authHeader = getHeader(event, 'authorization');
  const refreshToken = getHeader(event, 'x-refresh-token');

  if (!authHeader) {
    throw createError({
      statusCode: 401,
      message: 'No token provided to server',
    });
  }

  let accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // Track new tokens produced by any server-side refresh so we can always
  // propagate them back to the client regardless of which code path ran.
  let rotatedTokens: TokenResponse | null = null;

  // Pre-request refresh: if the access token is close to expiry and we have a
  // refresh token, rotate now before the upstream call.
  if (refreshToken) {
    const expired = isTokenExpired(accessToken, 30);

    if (expired) {
      try {
        const tokenData = await refreshAccessToken(refreshToken);
        accessToken = tokenData.accessToken;
        rotatedTokens = tokenData;
      } catch (err: unknown) {
        const { statusCode, message } = toApiHttpError(err);
        const actuallyExpired = isTokenExpired(accessToken, 0);

        if (!actuallyExpired && statusCode === 403) {
          // Client already rotated the refresh token; the access token in the
          // request is still valid — proceed with it.
        } else if (actuallyExpired && statusCode === 403) {
          // Access is genuinely expired but refresh token was already rotated.
          // Signal the client to retry with its latest stored tokens.
          throw createError({
            statusCode: 401,
            message: `${AUTH_RETRY_MESSAGE}. Please retry with new tokens.`,
          });
        } else {
          throw createError({ statusCode: statusCode || 401, message });
        }
      }
    }
  }

  const makeRequest = async (token: string) => {
    const response = await apiFetch<T>(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    }, event);
    return { data: response, headers: {} };
  };

  try {
    const result = await makeRequest(accessToken);
    return {
      ...result,
      headers: rotatedTokens
        ? {
            'x-new-access-token': rotatedTokens.accessToken,
            'x-new-refresh-token': rotatedTokens.refreshToken,
          }
        : {},
    };
  } catch (err: unknown) {
    const status = getHttpStatusCode(err);

    // Fallback refresh: access token expired between our check and the actual
    // request (race condition), or wasn't caught by the buffer above.
    if (status === 401 && refreshToken) {
      try {
        const data = await refreshAccessToken(refreshToken);
        rotatedTokens = data;
        const result = await makeRequest(data.accessToken);
        return {
          ...result,
          headers: {
            'x-new-access-token': data.accessToken,
            'x-new-refresh-token': data.refreshToken,
          },
        };
      } catch (refreshErr: unknown) {
        const { statusCode, message } = toApiHttpError(refreshErr);
        throw createError({ statusCode: statusCode || 401, message });
      }
    }

    throw err;
  }
}
