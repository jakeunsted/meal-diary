const APPLE_JS_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

interface AppleIdAuth {
  init: (config: {
    clientId: string;
    scope: string;
    redirectURI: string;
    nonce?: string;
    usePopup: boolean;
  }) => void;
  signIn: () => Promise<{
    authorization?: { id_token?: string };
    user?: { name?: { firstName?: string; lastName?: string } };
  }>;
}

declare global {
  interface Window {
    AppleID?: { auth: AppleIdAuth };
  }
}

export interface AppleWebCredential {
  idToken: string;
  rawNonce: string;
  givenName?: string;
  familyName?: string;
}

export const appleRedirectUri = (): string => {
  return `${window.location.origin}/auth/apple/callback`;
};

const appleAuth = (): AppleIdAuth => {
  if (!window.AppleID) {
    throw new Error('Sign in with Apple failed to load');
  }
  return window.AppleID.auth;
};

export const loadAppleJs = (): Promise<void> => {
  if (window.AppleID) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('Failed to load Sign in with Apple'));
    const existing = document.querySelector<HTMLScriptElement>('script[data-apple-auth="true"]');
    if (existing) {
      if (window.AppleID) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = APPLE_JS_SRC;
    script.async = true;
    script.dataset.appleAuth = 'true';
    script.onload = () => resolve();
    script.onerror = fail;
    document.head.appendChild(script);
  });
};

const randomNonce = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const isAppleCancel = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('error' in error)) {
    return false;
  }
  const code = String((error as { error?: string }).error);
  return code === 'popup_closed_by_user' || code === 'user_cancelled_authorize';
};

/** Initialise Apple JS on the popup return page. */
export const initApplePopup = async (clientId: string): Promise<void> => {
  await loadAppleJs();
  appleAuth().init({
    clientId,
    scope: 'name email',
    redirectURI: appleRedirectUri(),
    usePopup: true,
  });
};

/** Open the Sign in with Apple popup and return the identity token. */
export const signInWithApplePopup = async (clientId: string): Promise<AppleWebCredential> => {
  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);
  await loadAppleJs();
  appleAuth().init({
    clientId,
    scope: 'name email',
    redirectURI: appleRedirectUri(),
    nonce: hashedNonce,
    usePopup: true,
  });

  const result = await appleAuth().signIn();
  const idToken = result.authorization?.id_token;
  if (!idToken) {
    throw new Error('No identity token received from Apple');
  }

  return {
    idToken,
    rawNonce,
    givenName: result.user?.name?.firstName,
    familyName: result.user?.name?.lastName,
  };
};
