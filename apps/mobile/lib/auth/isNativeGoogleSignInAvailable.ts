import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Native Google Sign-In (`@react-native-google-signin/google-signin`) is not
 * included in Expo Go. Use a development build (`npx expo run:android`).
 */
export function isNativeGoogleSignInAvailable(): boolean {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}
