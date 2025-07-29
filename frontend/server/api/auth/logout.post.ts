import { apiFetch } from '../../utils/fetch';

export default defineEventHandler(async (event) => {
  try {
    // // Get the authorization header
    // const authHeader = getRequestHeader(event, 'authorization');
    
    // if (!authHeader) {
    //   // If no token, just return success since the user is already logged out
    //   return { success: true };
    // }
    
    // Forward the logout request to the API
    await apiFetch('/auth/logout', {
      method: 'POST',
    }, event);
    
    return { success: true };
  } catch (error: any) {
    // Even if the API call fails, we want to log the user out on the frontend
    // So we'll just log the error and return success
    console.error('Logout error:', error);
    return { success: true };
  }
}); 