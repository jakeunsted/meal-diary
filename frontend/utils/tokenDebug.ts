/**
 * Safe token debug helpers — never log full JWTs.
 * Use the same preview format on client and Nuxt server so logs can be correlated.
 */

export function tokenPreview(token: string | null | undefined): string {
  if (!token) return 'none';
  if (token.length < 16) return `[len=${token.length}]`;
  return `${token.slice(0, 12)}…${token.slice(-8)} (len=${token.length})`;
}

/**
 * Decode JWT payload without verification (expiry / iat only).
 */
export function tokenMeta(token: string | null | undefined): {
  preview: string;
  exp?: string;
  iat?: string;
  expiresInSeconds?: number;
  expired?: boolean;
  userId?: number;
  tokenId?: string;
} {
  const preview = tokenPreview(token);
  if (!token) return { preview };

  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return { preview };

    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';

    const decoded = JSON.parse(
      typeof atob === 'function'
        ? atob(payload)
        : Buffer.from(payload, 'base64').toString('utf-8')
    ) as { exp?: number; iat?: number; userId?: number; tokenId?: string };

    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresInSeconds = decoded.exp != null ? decoded.exp - nowSeconds : undefined;

    return {
      preview,
      exp: decoded.exp != null ? new Date(decoded.exp * 1000).toISOString() : undefined,
      iat: decoded.iat != null ? new Date(decoded.iat * 1000).toISOString() : undefined,
      expiresInSeconds,
      expired: expiresInSeconds != null ? expiresInSeconds <= 0 : undefined,
      userId: decoded.userId,
      tokenId: decoded.tokenId,
    };
  } catch {
    return { preview };
  }
}

export function newRefreshRequestId(): string {
  return `rfr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
