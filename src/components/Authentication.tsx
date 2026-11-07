import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type Auth, type User } from 'firebase/auth';
import { authenticationError, authConfigured, initializeAuthentication } from '../lib/auth';

type Account = {
  user: User | null;
  pending: boolean;
  error: string;
  login: () => Promise<User | null>;
  logout: () => Promise<void>;
};

const AccountContext = createContext<Account | null>(null);

export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error('Account context is unavailable');
  return account;
}

export function AccountButton() {
  const { user, pending, error, login, logout } = useAccount();
  return (
    <div className="account-control">
      {user ? (
        <>
          <span className="account-avatar" aria-hidden="true">{(user.displayName || user.email || 'G').slice(0, 1).toUpperCase()}</span>
          <div className="account-identity"><strong>{user.displayName || 'Tài khoản Google'}</strong><span>{user.email}</span></div>
          <button className="btn" disabled={pending} onClick={() => void logout()}>Đăng xuất</button>
        </>
      ) : (
        <button className="btn google-signin" disabled={pending} onClick={() => void login()}><img src="/google.svg" width="20" height="20" alt="" />Đăng nhập</button>
      )}
      {user && error && <p className="account-error" role="alert">{error}</p>}
    </div>
  );
}

export function Authentication({ children }: { children: (user: User | null, session: number) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const authRef = useRef<Auth | null>(null);
  const previousUser = useRef<string | null>(null);
  const busy = useRef(false);
  const request = useRef<{ promise: Promise<User | null>; resolve: (user: User | null) => void } | null>(null);
  const modal = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    initializeAuthentication().then((auth) => {
      if (!active) return;
      authRef.current = auth;
      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        if (previousUser.current && previousUser.current !== nextUser?.uid) setSession((value) => value + 1);
        previousUser.current = nextUser?.uid ?? null;
        setUser(nextUser);
        setReady(true);
      }, (failure) => {
        setError(authenticationError(failure));
        setUser(null);
        setReady(true);
      });
    }).catch((failure: unknown) => {
      if (!active) return;
      setError(authenticationError(failure));
      setReady(true);
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!showLogin) return;
    const focused = document.activeElement as HTMLElement | null;
    modal.current?.focus();
    return () => focused?.focus();
  }, [showLogin]);

  const finish = (account: User | null) => {
    request.current?.resolve(account);
    request.current = null;
    setShowLogin(false);
  };

  const login = (): Promise<User | null> => {
    const current = authRef.current?.currentUser;
    if (current) return Promise.resolve(current);
    if (request.current) return request.current.promise;
    let resolve!: (account: User | null) => void;
    const promise = new Promise<User | null>((done) => { resolve = done; });
    request.current = { promise, resolve };
    setShowLogin(true);
    return promise;
  };

  const signIn = async () => {
    if (busy.current || !authRef.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(authRef.current, provider);
      finish(result.user);
    } catch (failure) {
      setError(authenticationError(failure));
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const logout = async () => {
    if (!authRef.current || busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await signOut(authRef.current);
    } catch {
      setError('Chưa đăng xuất được. Vui lòng thử lại.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <AccountContext value={{ user, pending, error, login, logout }}>
      <div inert={showLogin}>{children(user, session)}</div>
      {showLogin && (
        <div className="dialog-backdrop">
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="login-title" aria-describedby="login-description" tabIndex={-1} ref={modal}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !pending) finish(null);
              if (event.key === 'Tab') {
                const buttons = modal.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
                if (!buttons?.length) return;
                const first = buttons[0];
                const last = buttons[buttons.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === modal.current)) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal.current)) { event.preventDefault(); first.focus(); }
              }
            }}>
            <h2 id="login-title">Đăng nhập để lưu tài liệu</h2>
            <p className="dialog-subtitle" id="login-description">Nội dung đang soạn được giữ nguyên. Đăng nhập Google để lưu vào kho riêng trên trình duyệt này; tài liệu chưa đồng bộ cloud.</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <p className="auth-disclosure">Chỉ xác thực tên, email và ảnh đại diện. Không yêu cầu quyền đọc Gmail hoặc Google Drive.</p>
            <div className="dialog-actions">
              <button className="btn" disabled={pending} onClick={() => finish(null)}>Tiếp tục chỉnh sửa</button>
              <button className="btn btn-primary google-signin" disabled={pending || !ready || !authConfigured} onClick={() => void signIn()}><img src="/google.svg" width="20" height="20" alt="" />{pending ? 'Đang chờ Google…' : !ready ? 'Đang kiểm tra tài khoản…' : 'Đăng nhập bằng Google'}</button>
            </div>
          </section>
        </div>
      )}
    </AccountContext>
  );
}
