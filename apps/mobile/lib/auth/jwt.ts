export function decodeJWT(
  token: string
): { exp?: number; iat?: number; [key: string]: unknown } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) {
      payload += '=';
    }

    const decoded = atob(payload);
    return JSON.parse(decoded) as { exp?: number; iat?: number; [key: string]: unknown };
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, bufferSeconds = 60): boolean {
  const decoded = decodeJWT(token);
  if (!decoded?.exp) return true;

  const expirationTime = decoded.exp * 1000;
  const bufferTime = bufferSeconds * 1000;
  return Date.now() + bufferTime >= expirationTime;
}
