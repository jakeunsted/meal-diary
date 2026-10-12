import * as Network from 'expo-network';

export function isNetworkStateOnline(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  if (state.isConnected === false) {
    return false;
  }
  if (state.isInternetReachable === false) {
    return false;
  }
  return true;
}

export async function isShoppingListDeviceOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return isNetworkStateOnline(state);
  } catch {
    return true;
  }
}
