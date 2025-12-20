export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const baseUrl = config.public.baseUrl;
    
    // Redirect to backend Google OAuth endpoint
    // The backend will handle the redirect to Google
    const backendUrl = `${baseUrl}/auth/google`;
    
    // Return a redirect response
    return sendRedirect(event, backendUrl, 302);
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'An error occurred during Google OAuth initiation'
    });
  }
});

