import { LogIn, LogOut, RefreshCw } from 'lucide-react';

import { useAuthSession } from '@/components/auth/AuthContext';

type AuthSessionControlsProps = {
  variant?: 'card' | 'bar';
};

export function AuthSessionControls({ variant = 'card' }: AuthSessionControlsProps) {
  const {
    session,
    error,
    bootstrapping,
    loggingIn,
    loggingOut,
    useFirebaseLogin,
    refresh,
    login,
    signOut,
  } = useAuthSession();

  if (bootstrapping && !session) {
    return (
      <div className={`auth-session auth-session--${variant}`} aria-busy="true">
        <span className="auth-session__muted">Oturum kontrol ediliyor…</span>
      </div>
    );
  }

  if (!session?.enabled) {
    return (
      <div className={`auth-session auth-session--${variant}`}>
        <p className="auth-session__title">Oturum</p>
        <p className="auth-session__muted">Geliştirme modu — giriş zorunlu değil.</p>
      </div>
    );
  }

  if (!session.configured) {
    return (
      <div className={`auth-session auth-session--${variant}`}>
        <p className="auth-session__title">Oturum</p>
        <p className="auth-session__muted">Giriş servisi yapılandırılmamış.</p>
      </div>
    );
  }

  if (session.authenticated && session.user) {
    const user = session.user;
    return (
      <div className={`auth-session auth-session--${variant} auth-session--signed-in`}>
        <div className="auth-session__user">
          {user.picture ? (
            <img src={user.picture} alt="" className="auth-session__avatar" referrerPolicy="no-referrer" />
          ) : (
            <span className="auth-session__avatar auth-session__avatar--fallback" aria-hidden="true">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="auth-session__identity">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <button
          type="button"
          className="auth-session__btn auth-session__btn--logout"
          disabled={loggingOut}
          onClick={() => void signOut()}
        >
          <LogOut size={16} />
          {loggingOut ? 'Kapatılıyor…' : 'Oturumu kapat'}
        </button>
      </div>
    );
  }

  return (
    <div className={`auth-session auth-session--${variant} auth-session--signed-out`}>
      <p className="auth-session__title">Oturum aç</p>
      <p className="auth-session__muted">Google hesabınla güvenli giriş yap.</p>
      {error && <p className="auth-session__error">{error}</p>}
      {useFirebaseLogin ? (
        <button
          type="button"
          className="auth-session__btn auth-session__btn--login"
          disabled={loggingIn}
          onClick={() => void login()}
        >
          <LogIn size={16} />
          {loggingIn ? 'Yönlendiriliyor…' : 'Oturum aç'}
        </button>
      ) : (
        <a className="auth-session__btn auth-session__btn--login" href="#" onClick={(e) => { e.preventDefault(); void login(); }}>
          <LogIn size={16} />
          Oturum aç
        </a>
      )}
      <button type="button" className="auth-session__link" onClick={() => void refresh()}>
        <RefreshCw size={14} />
        Durumu yenile
      </button>
    </div>
  );
}
