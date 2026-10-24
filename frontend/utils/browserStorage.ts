const LEGACY_PREFIX = 'CapacitorStorage.';

let legacyKeysPurged = false;

function storage(): Storage | null {
  if (!import.meta.client) return null;
  try {
    if (!legacyKeysPurged) {
      legacyKeysPurged = true;
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(LEGACY_PREFIX)) localStorage.removeItem(key);
      }
    }
    return localStorage;
  } catch {
    return null;
  }
}

export const browserStorage = {
  get: (key: string) => storage()?.getItem(key) ?? null,
  set(key: string, value: string) {
    try {
      storage()?.setItem(key, value);
    } catch {
      /* private mode or quota */
    }
  },
  remove(key: string) {
    try {
      storage()?.removeItem(key);
    } catch {
      /* private mode */
    }
  },
};
