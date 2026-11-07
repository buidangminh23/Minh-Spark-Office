import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type Auth, type User } from 'firebase/auth';
import { authenticationError, authConfigured, initializeAuthentication } from '../lib/auth';

type Account = {
  user: User | null;
  pending: boolean;
  error: string;
  login: () => Promise<void>;
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
        <button className="btn google-signin" disabled={pending} onClick={() => void login()}>{pending ? 'Đang đăng nhập…' : 'Đăng nhập bằng Google'}</button>
      )}
      {error && <p className="account-error" role="alert">{error}</p>}
    </div>
  );
}

export function Authentication({ children }: { children: (user: User | null) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const authRef = useRef<Auth | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    initializeAuthentication().then((auth) => {
      if (!active) return;
      authRef.current = auth;
      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setGuest(false);
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

  const login = async () => {
    if (busy.current) return;
    if (!authRef.current) {
      setError(authConfigured ? 'Dịch vụ đăng nhập chưa sẵn sàng. Hãy tải lại trang rồi thử lại.' : authenticationError(new Error('auth/missing-config')));
      return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(authRef.current, provider);
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
      {ready && (user || guest) ? children(user) : (
        <main className="auth-page">
          <section className="auth-card" aria-labelledby="auth-title">
            <img className="auth-logo" src="/logo-icon.png" alt="" />
            <p className="auth-brand">MINH SPARK OFFICE</p>
            <h1 id="auth-title">Không gian làm việc của riêng mỗi người</h1>
            <p className="auth-intro">Soạn văn bản, làm bảng tính và quản lý PDF trong một nơi.</p>
            {!ready ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : (
              <>
                <button className="btn auth-google" disabled={pending || !authConfigured} onClick={() => void login()}>{pending ? 'Đang chờ Google…' : 'Đăng nhập bằng Google'}</button>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <p className="auth-disclosure">Chỉ sử dụng tên, email và ảnh đại diện để xác thực tài khoản. Không yêu cầu quyền đọc Gmail hoặc Google Drive.</p>
                <div className="auth-divider" />
                <button className="btn auth-local" disabled={pending} onClick={() => { setError(''); setGuest(true); }}>Dùng trên máy này, không đăng nhập</button>
                <p className="auth-local-note">Tài liệu cũ nằm trong chế độ này. Tài liệu của tài khoản Google được lưu riêng trên trình duyệt này, chưa đồng bộ cloud.</p>
              </>
            )}
          </section>
        </main>
      )}
    </AccountContext>
  );
}
