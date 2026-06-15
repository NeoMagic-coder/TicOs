import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  type AuthSession,
  completeFirebaseGoogleRedirect,
  fetchAuthSession,
  googleLoginUrl,
  loginWithFirebaseGoogle,
  logout,
} from '@/lib/auth';
import { isFirebaseConfigured, signOutFirebase } from '@/lib/firebase';

const currentPath = () => `${window.location.pathname}${window.location.search}`;

interface AuthContextValue {
  session: AuthSession | null;
  error: string;
  bootstrapping: boolean;
  loggingIn: boolean;
  loggingOut: boolean;
  useFirebaseLogin: boolean;
  refresh: () => Promise<void>;
  login: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState('');
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setSession(await fetchAuthSession());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Giriş durumu alınamadı.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        if (isFirebaseConfigured()) {
          try {
            const redirectedSession = await completeFirebaseGoogleRedirect();
            if (!active) return;
            if (redirectedSession) {
              setSession(await fetchAuthSession());
              return;
            }
          } catch (redirectError) {
            if (!active) return;
            setError(
              redirectError instanceof Error
                ? redirectError.message
                : 'Google girişi tamamlanamadı.',
            );
          }
        }
        await refresh();
      } finally {
        if (active) setBootstrapping(false);
      }
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, [refresh]);

  const useFirebaseLogin =
    Boolean(session?.firebase_configured) && isFirebaseConfigured();

  const login = useCallback(async () => {
    if (!session?.enabled || !session.configured) return;
    setLoggingIn(true);
    setError('');
    try {
      if (useFirebaseLogin) {
        await loginWithFirebaseGoogle();
        await refresh();
        return;
      }
      window.location.href = googleLoginUrl(currentPath());
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Google ile giriş yapılamadı.';
      if (message.includes('yönlendiriliyorsunuz')) return;
      setError(message);
    } finally {
      setLoggingIn(false);
    }
  }, [session?.configured, session?.enabled, useFirebaseLogin, refresh]);

  const signOut = useCallback(async () => {
    setLoggingOut(true);
    setError('');
    try {
      await logout();
      if (isFirebaseConfigured()) {
        await signOutFirebase();
      }
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Çıkış yapılamadı.');
    } finally {
      setLoggingOut(false);
    }
  }, [refresh]);

  const value = useMemo(
    () => ({
      session,
      error,
      bootstrapping,
      loggingIn,
      loggingOut,
      useFirebaseLogin,
      refresh,
      login,
      signOut,
    }),
    [session, error, bootstrapping, loggingIn, loggingOut, useFirebaseLogin, refresh, login, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthSession must be used within AuthProvider');
  }
  return context;
}
