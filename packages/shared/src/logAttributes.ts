/**
 * Convert arbitrary event properties into OpenTelemetry-safe log attributes.
 * Maps `session_id` to `sessionId` and drops non-primitive values.
 */
export const toLogAttributes = (
  properties?: Record<string, unknown>
): Record<string, string | number | boolean> => {
  const attributes: Record<string, string | number | boolean> = {};

  if (!properties) {
    return attributes;
  }

  for (const [key, value] of Object.entries(properties)) {
    if (key === 'session_id' && typeof value === 'string') {
      attributes.sessionId = value;
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      attributes[key] = value;
    }
  }

  return attributes;
};
