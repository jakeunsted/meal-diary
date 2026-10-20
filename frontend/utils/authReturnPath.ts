const AUTH_RETURN_PATH_KEY = 'authReturnPath';

export const isSafeInAppPath = (path: string): boolean =>
  path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');

export const rememberAuthReturnPath = (path?: string) => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  if (path && isSafeInAppPath(path)) {
    sessionStorage.setItem(AUTH_RETURN_PATH_KEY, path);
    return;
  }

  sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
};

export const consumeAuthReturnPath = (): string | null => {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  const path = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
  sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
  if (path && isSafeInAppPath(path)) {
    return path;
  }

  return null;
};
