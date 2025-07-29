import { apiFetch } from '../../utils/fetch';
import { User } from '../../../types/User';

// Define the expected response type from the API
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  statusCode: number;
  user: User;
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { email, password } = body;
    
    if (!email || !password) {
      throw createError({
        statusCode: 400,
        message: 'Email and password are required'
      });
    }
    
    const response = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, event);

    // Return the response without hardcoded redirect or server-side store usage
    return response;
  } catch (error: any) {
    // If the error is from the API, pass through the status code and message
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'Authentication failed'
      });
    }
    
    // For other errors, return a generic error
    throw createError({
      statusCode: 500,
      message: error.message || 'An error occurred during login'
    });
  }
});