import { type ReactNode } from 'react';
import { LogOut } from 'lucide-react';

import { useAuthSession } from '@/components/auth/AuthContext';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { session, loggingOut, signOut } = useAuthSession();

  return (
    <>
      {children}
      {session?.authenticated && session.user && (
        <aside className="auth-user" aria-label="Oturum bilgisi">
          {session.user.picture ? (
            <img src={session.user.picture} alt="" className="auth-user__avatar" referrerPolicy="no-referrer" />
          ) : (
            <span className="auth-user__avatar auth-user__avatar--fallback" aria-hidden="true">
              {(session.user.name || session.user.email).slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="auth-user__identity">
            <strong>{session.user.name}</strong>
            <small>{session.user.email}</small>
          </span>
          <button
            type="button"
            className="auth-user__logout"
            aria-label="Oturumu kapat"
            disabled={loggingOut}
            onClick={() => void signOut()}
          >
            <LogOut size={15} />
            <span>{loggingOut ? 'Kapatılıyor…' : 'Oturumu kapat'}</span>
          </button>
        </aside>
      )}
    </>
  );
}
