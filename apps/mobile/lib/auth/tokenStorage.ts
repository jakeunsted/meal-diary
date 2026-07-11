import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { ResolvedEntitlements, User } from '@/types/api';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const AUTH_STATE_KEY = 'authState';

export interface StoredAuthState {
  user: User;
  accessToken: string;
  refreshToken: string;
  entitlements?: ResolvedEntitlements | null;
}

function getWebItem(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
}

function setWebItem(key: string, value: string): void {
  if (typeof localStorage === 'undefined') {
    throw new Error('Token storage is unavailable in this environment');
  }
  localStorage.setItem(key, value);
}

function deleteWebItem(key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

async function getNativeItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

async function setNativeItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

async function deleteNativeItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

export async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') return getWebItem(ACCESS_TOKEN_KEY);
  return getNativeItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') return getWebItem(REFRESH_TOKEN_KEY);
  return getNativeItem(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  if (Platform.OS === 'web') {
    setWebItem(ACCESS_TOKEN_KEY, accessToken);
    setWebItem(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
  await setNativeItem(ACCESS_TOKEN_KEY, accessToken);
  await setNativeItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getAuthState(): Promise<StoredAuthState | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? getWebItem(AUTH_STATE_KEY)
        : await AsyncStorage.getItem(AUTH_STATE_KEY);

    if (!raw) return null;
    return JSON.parse(raw) as StoredAuthState;
  } catch {
    return null;
  }
}

export async function setAuthState(state: StoredAuthState): Promise<void> {
  const serialized = JSON.stringify(state);
  if (Platform.OS === 'web') {
    setWebItem(AUTH_STATE_KEY, serialized);
    setWebItem(ACCESS_TOKEN_KEY, state.accessToken);
    setWebItem(REFRESH_TOKEN_KEY, state.refreshToken);
    return;
  }
  await AsyncStorage.setItem(AUTH_STATE_KEY, serialized);
  await setNativeItem(ACCESS_TOKEN_KEY, state.accessToken);
  await setNativeItem(REFRESH_TOKEN_KEY, state.refreshToken);
}

export async function clearAuthState(): Promise<void> {
  if (Platform.OS === 'web') {
    deleteWebItem(AUTH_STATE_KEY);
    deleteWebItem(ACCESS_TOKEN_KEY);
    deleteWebItem(REFRESH_TOKEN_KEY);
    return;
  }
  await AsyncStorage.removeItem(AUTH_STATE_KEY);
  await deleteNativeItem(ACCESS_TOKEN_KEY);
  await deleteNativeItem(REFRESH_TOKEN_KEY);
}

/** @deprecated Use clearAuthState */
export async function clearTokens(): Promise<void> {
  await clearAuthState();
}
