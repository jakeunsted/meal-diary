export const INTERNAL_SERVER_ERROR_MESSAGE =
  'Internal server error. We are trying our best to restore the service.';

export const isInfrastructureError = (error: unknown): boolean =>
  /password authentication failed/i.test(error instanceof Error ? error.message : '');
