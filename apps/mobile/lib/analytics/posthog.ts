import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';

import { env } from '@/constants/env';
import type { AnalyticsConsentChoice } from '@/lib/analytics/consentChoice';
import type { User } from '@/types/api';

export const isAnalyticsDevBuild = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

const isReleaseBuild = !isAnalyticsDevBuild;
const isNativeReleaseBuild = isReleaseBuild && Platform.OS !== 'web';

export const posthogClient: PostHog | null = env.posthogKey
  ? new PostHog(env.posthogKey, {
      host: env.posthogHost,
      // Fail closed. Capture stays off until optIn(), including events queued during init.
      defaultOptIn: false,
      // Dev never registers lifecycle capture. Release does, but those events
      // are dropped until analytics consent is granted.
      captureAppLifecycleEvents: isReleaseBuild,
      // Session replay and native crashes need a release build of the iOS or Android app.
      enableSessionReplay: isNativeReleaseBuild,
      ...(isNativeReleaseBuild
        ? {
            sessionReplayConfig: {
              maskAllTextInputs: true,
              maskAllImages: true,
              screenshotScale: 0.5,
              screenshotColorMode: 'RGB_565' as const,
              screenshotCompressionQuality: 30,
            },
          }
        : {}),
      ...(isReleaseBuild
        ? {
            errorTracking: {
              autocapture: {
                uncaughtExceptions: true,
                unhandledRejections: true,
                // Native crashes are a no-op without the native plugin, including on web.
                nativeCrashes: isNativeReleaseBuild,
                androidNdkCrashes: isNativeReleaseBuild,
              },
            },
          }
        : {}),
      logs: {
        serviceName: 'meal-diary-mobile',
        environment: isAnalyticsDevBuild ? 'development' : 'production',
        serviceVersion: Constants.expoConfig?.version ?? '1.1.1',
      },
    })
  : null;

let captureAllowed = false;
let lastChoice: AnalyticsConsentChoice = null;
let captureQueue: Promise<void> = Promise.resolve();

function enqueueCaptureChange(task: () => Promise<void>): Promise<void> {
  const run = captureQueue.then(task, task);
  captureQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function applyCaptureChoice(choice: AnalyticsConsentChoice): Promise<void> {
  lastChoice = choice;
  const allow = !isAnalyticsDevBuild && choice === 'granted';
  captureAllowed = allow;

  if (!posthogClient) {
    return;
  }

  if (!allow) {
    await posthogClient.optOut();
    return;
  }

  await posthogClient.optIn();
}

if (posthogClient) {
  const client = posthogClient;
  void enqueueCaptureChange(() => client.optOut().then(() => undefined));
}

export function syncAnalyticsCapture(choice: AnalyticsConsentChoice): Promise<void> {
  return enqueueCaptureChange(() => applyCaptureChoice(choice));
}

export function revokeAnalyticsCapture(): Promise<void> {
  return enqueueCaptureChange(async () => {
    if (posthogClient) {
      await Promise.resolve(posthogClient.reset());
    }
    await applyCaptureChoice('denied');
  });
}

export function identifyUser(user: User): void {
  if (!posthogClient || !user?.id || !captureAllowed) {
    return;
  }

  const firstName = user.first_name ?? '';
  const lastName = user.last_name ?? '';
  const name = `${firstName} ${lastName}`.trim();

  posthogClient.identify(String(user.id), {
    email: user.email,
    ...(name ? { name } : {}),
  });
}

export function resetAnalytics(): void {
  if (!posthogClient) {
    return;
  }

  void enqueueCaptureChange(async () => {
    await Promise.resolve(posthogClient?.reset());
    await applyCaptureChoice(lastChoice);
  });
}

interface LogAttributes {
  [key: string]: string | number | boolean;
}

function withCapture(run: () => void): void {
  if (!captureAllowed) {
    return;
  }
  run();
}

export function logInfo(body: string, attributes?: LogAttributes): void {
  withCapture(() => posthogClient?.logger.info(body, attributes));
}

export function logWarn(body: string, attributes?: LogAttributes): void {
  withCapture(() => posthogClient?.logger.warn(body, attributes));
}

export function logError(body: string, attributes?: LogAttributes): void {
  withCapture(() => posthogClient?.logger.error(body, attributes));
}

export function captureEvent(
  event: string,
  properties?: Record<string, string | number | boolean>
): void {
  withCapture(() => posthogClient?.capture(event, properties));
}

export function captureException(
  error: unknown,
  properties?: Record<string, string | number | boolean>
): void {
  withCapture(() => posthogClient?.captureException(error, properties));
}
