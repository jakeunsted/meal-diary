/**
 * Decode JWT token without verification (for expiration checking only)
 * This is safe because we're only checking expiration, not verifying the signature
 */
export function decodeJWT(token: string): { exp?: number; iat?: number; [key: string]: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    // JWT uses base64url encoding which uses - and _ instead of + and /
    let payload = parts[1];
    
    // Convert base64url to base64
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    while (payload.length % 4) {
      payload += '=';
    }
    
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[JWT] Failed to decode token:', error);
    return null;
  }
}

/**
 * Check if a JWT token is expired or will expire soon
 * @param token - The JWT token to check
 * @param bufferSeconds - Number of seconds before expiration to consider it expired (default: 60)
 * @returns true if token is expired or will expire soon, false otherwise
 */
export function isTokenExpired(token: string, bufferSeconds: number = 60): boolean {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) {
    // If we can't decode or there's no expiration, assume it's expired to be safe
    return true;
  }

  const expirationTime = decoded.exp * 1000; // Convert to milliseconds
  const currentTime = Date.now();
  const bufferTime = bufferSeconds * 1000;
  const timeUntilExpiration = expirationTime - currentTime;
  const timeUntilExpirationSeconds = Math.floor(timeUntilExpiration / 1000);
  
  // If token was issued very recently (within last 10 seconds), it's likely just refreshed
  // Don't consider it expired to avoid unnecessary server-side refresh attempts
  const issuedAt = decoded.iat ? decoded.iat * 1000 : null;
  const tokenAge = issuedAt ? currentTime - issuedAt : null;
  const isVeryNew = tokenAge !== null && tokenAge < 10000; // Less than 10 seconds old

  // Token is expired if current time + buffer is past expiration
  const expired = currentTime + bufferTime >= expirationTime;

  // If token is very new, don't consider it expired (client likely just refreshed)
  if (isVeryNew && !expired) {
    return false;
  }

  return expired;
}

/**
 * Get the expiration time of a JWT token in milliseconds
 * @param token - The JWT token
 * @returns Expiration time in milliseconds, or null if unable to decode
 */
export function getTokenExpiration(token: string): number | null {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) {
    return null;
  }
  return decoded.exp * 1000; // Convert to milliseconds
}

