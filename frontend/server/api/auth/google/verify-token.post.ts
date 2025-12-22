import { apiFetch } from '~/server/utils/fetch';
import { User } from '~/types/User';

// Define the expected response type from the API
interface GoogleAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { idToken } = body;

    if (!idToken) {
      throw createError({
        statusCode: 400,
        message: 'ID token is required'
      });
    }

    const response = await apiFetch<GoogleAuthResponse>('/auth/google/verify-token', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }, event);

    return response;
  } catch (error: any) {
    // If the error is from the API, pass through the status code and message
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'Token verification failed'
      });
    }

    // For other errors, return a generic error
    throw createError({
      statusCode: 500,
      message: error.message || 'An error occurred during Google token verification'
    });
  }
});
