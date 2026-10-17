/**
 * Normalize an Express route/query param to a single string.
 * Express 5 types allow `string | string[]` for params.
 */
export const routeParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

export const routeParamInt = (
  value: string | string[] | undefined,
  radix = 10
): number => {
  return parseInt(routeParam(value), radix);
};
