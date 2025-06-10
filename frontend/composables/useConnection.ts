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
      const response = await $fetch('/api/health', { 
        method: 'HEAD',
        timeout
      });
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Watch for connection changes and execute a callback
   * @param callback - Function to execute when connection status changes
   * @param interval - Check interval in milliseconds (default: 30000)
   * @returns Function to stop watching
   */
  const watchConnection = (callback: (isConnected: boolean) => void, interval = 30000) => {
    let isWatching = true;

    const check = async () => {
      if (!isWatching) return;
      
      const isConnected = await checkConnection();
      callback(isConnected);
      
      if (isWatching) {
        setTimeout(check, interval);
      }
    };

    check();

    return () => {
      isWatching = false;
    };
  };

  return {
    checkConnection,
    watchConnection
  };
};
