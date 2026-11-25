import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, getRedirectResult, signInWithCredential, signInWithPopup, signInWithRedirect, signOut, type Auth, type User } from 'firebase/auth';
import { authenticationError, authConfigured, initializeAuthentication, isTouchBrowser, usesSameOriginAuth } from '../lib/auth';
import { CheckCircle2, Cloud, Loader2, Lock, MonitorSmartphone, X } from 'lucide-react';
import { isDesktop } from '../lib/desktop';
import { beginDesktopLogin } from '../lib/desktopLogin';

type Account = {
  user: User | null;
  ready: boolean;
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
  const desktopAbort = useRef<AbortController | null>(null);

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
      if (usesSameOriginAuth()) {
        getRedirectResult(auth).catch((failure: unknown) => {
          if (active) setError(authenticationError(failure));
        });
      }
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
    desktopAbort.current?.abort();
    desktopAbort.current = null;
    request.current?.resolve(account);
    request.current = null;
    setShowLogin(false);
  };

  const desktopMessages: Record<string, string> = {
    'auth/desktop-timeout': 'Yêu cầu đăng nhập đã hết hạn sau 5 phút. Hãy đăng nhập lại.',
    'auth/desktop-cancelled': 'Đã hủy đăng nhập.',
    'auth/desktop-browser': 'Không mở được trình duyệt mặc định. Hãy kiểm tra trình duyệt rồi thử lại.',
    'auth/desktop-invalid-request': 'Không tạo được yêu cầu đăng nhập. Hãy thử lại.',
    'auth/desktop-invalid-payload': 'Dữ liệu đăng nhập nhận về không hợp lệ. Hãy đăng nhập lại.',
  };

  const failed = (failure: unknown) => {
    const code = failure instanceof Error ? failure.message : '';
    setError(desktopMessages[code] || authenticationError(failure));
  };

  const signInDesktop = async (auth: Auth) => {
    const controller = new AbortController();
    desktopAbort.current = controller;
    const login = await beginDesktopLogin(auth, controller.signal);
    const received = await login.result;
    finish((await signInWithCredential(auth, GoogleAuthProvider.credential(received.idToken))).user);
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
      if (isDesktop()) {
        await signInDesktop(authRef.current);
      } else {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        if (usesSameOriginAuth() && isTouchBrowser()) {
          await signInWithRedirect(authRef.current, provider);
          return;
        }
        finish((await signInWithPopup(authRef.current, provider)).user);
      }
    } catch (failure) {
      if (!(failure instanceof Error && failure.message === 'auth/desktop-cancelled' && !desktopAbort.current)) failed(failure);
    } finally {
      desktopAbort.current = null;
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
    <AccountContext value={{ user, ready, pending, error, login, logout }}>
      <div inert={showLogin}>{children(user, session)}</div>
      {showLogin && (
        <div className="dialog-backdrop">
          <section className="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title" aria-describedby="login-description" tabIndex={-1} ref={modal}
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
            {!pending && (
              <button className="auth-close" type="button" aria-label="Đóng" onClick={() => finish(null)}><X size={20} aria-hidden="true" /></button>
            )}
            <header className="auth-head">
              <img className="auth-logo" src="/logo-icon-256.webp" alt="" width="64" height="64" />
              <div className="auth-title">
                <h2 id="login-title">Đăng nhập Office 23</h2>
                <p className="auth-intro" id="login-description">Nội dung đang soạn vẫn được giữ nguyên.</p>
              </div>
            </header>
            {pending && isDesktop() ? (
              <div className="auth-waiting" role="status">
                <Loader2 className="auth-spin" size={28} aria-hidden="true" />
                <strong>Đang chờ đăng nhập trên trình duyệt</strong>
                <span>Chọn tài khoản Google trong tab vừa mở. Xong là ứng dụng tự đăng nhập và đồng bộ.</span>
              </div>
            ) : (
              <ul className="auth-benefits">
                <li><MonitorSmartphone size={20} aria-hidden="true" /><span>Mở cùng một kho tài liệu trên web, máy tính và máy tính bảng</span></li>
                <li><Cloud size={20} aria-hidden="true" /><span>Tự lưu và đồng bộ ngay khi đăng nhập đúng tài khoản</span></li>
                <li><CheckCircle2 size={20} aria-hidden="true" /><span>Không mất nội dung đang soạn</span></li>
              </ul>
            )}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="auth-buttons">
              {pending && isDesktop() ? (
                <button className="btn auth-secondary" type="button" onClick={() => finish(null)}>Hủy đăng nhập</button>
              ) : (
                <>
                  <button className="btn auth-google google-signin" type="button" disabled={pending || !ready || !authConfigured} onClick={() => void signIn()}>
                    {pending ? <Loader2 className="auth-spin" size={20} aria-hidden="true" /> : <img src="/google.svg" width="20" height="20" alt="" />}
                    {pending ? 'Đang chờ Google…' : !ready ? 'Đang kiểm tra tài khoản…' : 'Đăng nhập bằng Google'}
                  </button>
                  <button className="btn auth-secondary" type="button" disabled={pending} onClick={() => finish(null)}>Tiếp tục chỉnh sửa, đăng nhập sau</button>
                </>
              )}
            </div>
            <p className="auth-privacy"><Lock size={14} aria-hidden="true" />Chỉ dùng tên, email và ảnh đại diện. Không đọc Gmail hay Google Drive.</p>
          </section>
        </div>
      )}
    </AccountContext>
  );
}
