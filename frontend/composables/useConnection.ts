import { useApi } from "./useApi";

/**
 * Composable for checking internet connection status
 */
export const useConnection = () => {
  /**
   * Check if there is an active internet connection
   * @param timeout - Timeout in milliseconds (default: 5000)
   * @returns Promise<boolean> - True if connected, false otherwise
   */
  const checkConnection = async (timeout = 5000): Promise<boolean> => {
    try {
      const { api } = useApi();
      await api('/api/health', { 
        method: 'get',
        timeout
      });
      return true;
    } catch {
      return false;
    }
  };

  return {
    checkConnection
  };
};
