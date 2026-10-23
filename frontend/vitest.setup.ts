import { beforeEach } from 'vitest';
import { computed, nextTick, readonly, ref, watch, watchEffect } from 'vue';

declare global {
  var __NUXT_CLIENT__: boolean;
  var __NUXT_DEV__: boolean;
  var __NUXT_SERVER__: boolean;
  var flushMounted: () => void;
  var flushUnmounted: () => void;
}

const mountedHooks: Array<() => void> = [];
const unmountedHooks: Array<() => void> = [];

globalThis.__NUXT_CLIENT__ = false;
globalThis.__NUXT_DEV__ = false;
globalThis.__NUXT_SERVER__ = true;

const useStateValues = new Map<string, ReturnType<typeof ref>>();

Object.assign(globalThis, {
  ref,
  computed,
  readonly,
  watch,
  watchEffect,
  nextTick,
  onMounted: (hook: () => void) => {
    mountedHooks.push(hook);
  },
  onUnmounted: (hook: () => void) => {
    unmountedHooks.push(hook);
  },
  onBeforeUnmount: (hook: () => void) => {
    unmountedHooks.push(hook);
  },
  defineNuxtPlugin: (plugin: unknown) => plugin,
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    locale: ref('en'),
  }),
  useState: (key: string, init?: () => unknown) => {
    if (!useStateValues.has(key)) {
      useStateValues.set(key, ref(init ? init() : null));
    }
    return useStateValues.get(key);
  },
  useRuntimeConfig: () => ({ public: {} }),
  useNuxtApp: () => ({
    $posthog: undefined,
    $sse: { setup: () => null, close: () => {} },
    provide: () => {},
  }),
  useRoute: () => ({ path: '/', query: {} }),
  useRouter: () => ({
    push: async () => {},
    replace: async () => {},
    currentRoute: ref({ path: '/' }),
  }),
  reloadNuxtApp: () => {},
  navigateTo: async () => {},
  $fetch: async () => ({}),
  flushMounted: () => {
    const hooks = mountedHooks.splice(0);
    for (const hook of hooks) hook();
  },
  flushUnmounted: () => {
    const hooks = unmountedHooks.splice(0);
    for (const hook of hooks) hook();
  },
});

(process as NodeJS.Process & { client?: boolean; dev?: boolean; server?: boolean }).client = false;
(process as NodeJS.Process & { client?: boolean; dev?: boolean; server?: boolean }).dev = false;
(process as NodeJS.Process & { client?: boolean; dev?: boolean; server?: boolean }).server = true;

beforeEach(() => {
  mountedHooks.length = 0;
  unmountedHooks.length = 0;
  globalThis.__NUXT_CLIENT__ = false;
  globalThis.__NUXT_DEV__ = false;
  globalThis.__NUXT_SERVER__ = true;
  (process as NodeJS.Process & { client?: boolean; dev?: boolean; server?: boolean }).client = false;
  (process as NodeJS.Process & { client?: boolean; dev?: boolean; server?: boolean }).dev = false;
  (process as NodeJS.Process & { client?: boolean; dev?: boolean; server?: boolean }).server = true;
});
