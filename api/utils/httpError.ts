/**
 * Error thrown when a fetch call returns a non-2xx response.
 * Carries the HTTP status and the parsed response body so callers
 * (e.g. analytics sanitisation) can classify the failure.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }
}
