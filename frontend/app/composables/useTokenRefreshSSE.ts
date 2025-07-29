import { useAuthStore } from '../../stores/auth';

interface TokenRefreshData {
  accessToken: string;
  refreshToken: string;
  userId: number;
}

export const useTokenRefreshSSE = () => {
  const authStore = useAuthStore();

  /**
   * Handles token refresh events from SSE
   * This function is called when the server emits a token-refresh event
   */
  const handleTokenRefresh = (data: TokenRefreshData) => {
    // Update the auth store with new tokens
    authStore.updateTokensFromSSE(data);
  };

  return {
    handleTokenRefresh
  };
};
