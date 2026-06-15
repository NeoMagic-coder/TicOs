import { BASE_URL } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface AuthSession {
  enabled: boolean;
  configured: boolean;
  oauth_configured?: boolean;
  firebase_configured?: boolean;
  authenticated: boolean;
  user: AuthUser | null;
}

export async function fetchAuthSession(): Promise<AuthSession> {
  const response = await fetch(`${BASE_URL}/api/v1/auth/session`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Auth session request failed: HTTP ${response.status}`);
  }
  return response.json() as Promise<AuthSession>;
}

export function googleLoginUrl(nextPath: string): string {
  return `${BASE_URL}/api/v1/auth/login?next=${encodeURIComponent(nextPath)}`;
}

export async function loginWithFirebase(idToken: string): Promise<AuthSession> {
  const response = await fetch(`${BASE_URL}/api/v1/auth/firebase`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = detail || `Firebase login failed: HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(detail) as { detail?: string };
      if (parsed.detail) message = parsed.detail;
    } catch {
      // keep raw detail
    }
    throw new Error(message);
  }
  return response.json() as Promise<AuthSession>;
}

export async function loginWithFirebaseGoogle(): Promise<AuthSession> {
  const { signInWithGoogle, startGoogleRedirectSignIn } = await import('@/lib/firebase');
  try {
    const credential = await signInWithGoogle();
    const idToken = await credential.user.getIdToken();
    return loginWithFirebase(idToken);
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'auth/popup-blocked' || message.includes('auth/popup-blocked')) {
      await startGoogleRedirectSignIn();
      throw new Error('Google hesabına yönlendiriliyorsunuz…');
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Giriş penceresi kapatıldı. Tekrar deneyin.');
    }
    if (code === 'auth/cancelled-popup-request') {
      throw new Error('Giriş penceresi açılamadı. Tekrar deneyin.');
    }
    throw error instanceof Error ? error : new Error(message);
  }
}

export async function completeFirebaseGoogleRedirect(): Promise<AuthSession | null> {
  const { completeGoogleRedirectSignIn } = await import('@/lib/firebase');
  const idToken = await completeGoogleRedirectSignIn();
  if (!idToken) return null;
  return loginWithFirebase(idToken);
}

export async function startFirebaseGoogleRedirect(): Promise<void> {
  const { startGoogleRedirectSignIn } = await import('@/lib/firebase');
  await startGoogleRedirectSignIn();
}

export async function logout(): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Logout failed: HTTP ${response.status}`);
  }
}

let credentialedFetchInstalled = false;

export function installCredentialedBackendFetch(): void {
  if (credentialedFetchInstalled) return;
  credentialedFetchInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const backendOrigin = new URL(BASE_URL, window.location.href).origin;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const targetOrigin = new URL(rawUrl, window.location.href).origin;
    if (targetOrigin !== backendOrigin) return nativeFetch(input, init);
    return nativeFetch(input, {
      ...init,
      credentials: init?.credentials ?? 'include',
    });
  };
}
