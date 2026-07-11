import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REGISTER_CODE_KEY = 'registerString';

function getWebItem(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(REGISTER_CODE_KEY);
}

function setWebItem(value: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(REGISTER_CODE_KEY, value);
}

function deleteWebItem(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(REGISTER_CODE_KEY);
}

export async function storeRegisterCode(code: string): Promise<void> {
  if (Platform.OS === 'web') {
    setWebItem(code);
    return;
  }
  await AsyncStorage.setItem(REGISTER_CODE_KEY, code);
}

export async function getRegisterCode(): Promise<string | null> {
  if (Platform.OS === 'web') return getWebItem();
  return AsyncStorage.getItem(REGISTER_CODE_KEY);
}

export async function clearRegisterCode(): Promise<void> {
  if (Platform.OS === 'web') {
    deleteWebItem();
    return;
  }
  await AsyncStorage.removeItem(REGISTER_CODE_KEY);
}
