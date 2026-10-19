export interface TourTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourTargetRegistration {
  measure: () => Promise<TourTargetRect | null>;
}

const registrations = new Map<string, TourTargetRegistration>();
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

export function registerTourTarget(
  id: string,
  measure: () => Promise<TourTargetRect | null>
): void {
  registrations.set(id, { measure });
  publish();
}

export function unregisterTourTarget(id: string): void {
  if (!registrations.has(id)) {
    return;
  }
  registrations.delete(id);
  publish();
}

export function listRegisteredTourTargetIds(): string[] {
  return Array.from(registrations.keys());
}

export async function measureTourTarget(id: string): Promise<TourTargetRect | null> {
  const entry = registrations.get(id);
  if (!entry) {
    return null;
  }
  try {
    return await entry.measure();
  } catch {
    return null;
  }
}

export function subscribeTourTargets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let notifyTimer: ReturnType<typeof setTimeout> | null = null;

/** Ask the overlay to remeasure after a target lays out or scrolls. */
export function notifyTourTargetsChanged(options?: { immediate?: boolean }): void {
  if (options?.immediate) {
    if (notifyTimer) {
      clearTimeout(notifyTimer);
      notifyTimer = null;
    }
    publish();
    return;
  }

  // Debounce layout chatter (especially Profile scroll) so the hole does not jump.
  if (notifyTimer) {
    clearTimeout(notifyTimer);
  }
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    publish();
  }, 120);
}

export type ProfileTourScrollRequest = 'invite';

type ProfileTourScrollHandler = (request: ProfileTourScrollRequest) => void | Promise<void>;

let profileTourScrollHandler: ProfileTourScrollHandler | null = null;

export function registerProfileTourScrollHandler(
  handler: ProfileTourScrollHandler
): () => void {
  profileTourScrollHandler = handler;
  return () => {
    if (profileTourScrollHandler === handler) {
      profileTourScrollHandler = null;
    }
  };
}

/** Position Profile for the invite step. Resolves when scrolling has settled. */
export async function requestProfileTourScroll(
  request: ProfileTourScrollRequest
): Promise<void> {
  const handler = profileTourScrollHandler;
  if (!handler) {
    return;
  }
  await handler(request);
}
