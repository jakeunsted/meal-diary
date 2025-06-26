# Automatic Logout on 401 Errors

This document describes the automatic logout functionality that triggers when a 401 error occurs and token refresh fails.

## Overview

When a user's access token expires and the refresh token also fails to refresh, the application automatically logs out the user and redirects them to the login page. This prevents users from being stuck in an invalid authentication state.

## Implementation Details

### 1. Server-Side Token Refresh Handling

The server-side fetch utilities (`frontend/server/utils/fetch.ts` and `frontend/server/utils/auth.ts`) handle 401 errors by:

1. Attempting to refresh the token using the refresh token
2. If refresh succeeds, retrying the original request with the new token
3. If refresh fails, triggering automatic logout

### 2. Client-Side Error Handling

The client-side implements multiple layers of error handling:

#### useAuth Composable (`frontend/composables/useAuth.ts`)
- `handleAutoLogout()` function that clears auth state and redirects to login
- `refreshTokens()` function that calls `handleAutoLogout()` when refresh fails

#### Global Error Handler (`frontend/plugins/error-handler.ts`)
- Catches 401 errors from global fetch calls
- Handles unhandled promise rejections with 401 status codes

#### API Error Handler Composable (`frontend/composables/useApiErrorHandler.ts`)
- Provides `withErrorHandling()` wrapper for API calls
- Provides `safeFetch()` wrapper for $fetch calls

### 3. Auth Store (`frontend/stores/auth.ts`)
- `autoLogout()` method for clearing auth state
- `clearAuth()` method that removes all auth-related data from storage

## Usage

### Automatic Handling
The automatic logout is handled automatically by the system. No additional code is required in most cases.

### Manual Error Handling
If you need to manually handle 401 errors in your components:

```typescript
import { useApiErrorHandler } from '~/composables/useApiErrorHandler';

const { withErrorHandling, safeFetch } = useApiErrorHandler();

// Wrap API calls
const data = await withErrorHandling(() => $fetch('/api/some-endpoint'));

// Or use safeFetch
const data = await safeFetch('/api/some-endpoint');
```

### Manual Logout Trigger
If you need to manually trigger automatic logout:

```typescript
import { handleAutoLogout } from '~/composables/useAuth';

await handleAutoLogout();
```

## Flow Diagram

```
API Request → 401 Error → Token Refresh Attempt
                              ↓
                        Refresh Success? → Yes → Retry Request
                              ↓ No
                        Trigger Auto Logout → Clear Auth State → Redirect to Login
```

## Testing

To test the automatic logout functionality:

1. Wait for your access token to expire (or manually expire it on the server)
2. Make an API request that requires authentication
3. The system should automatically attempt to refresh the token
4. If refresh fails, you should be automatically logged out and redirected to login

## Configuration

The automatic logout behavior is enabled by default and doesn't require any configuration. The system will:

- Clear all auth-related data from storage
- Clear any cached data (meal diary, shopping list, etc.)
- Redirect to the login page
- Log the logout action for debugging purposes 