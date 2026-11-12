import { useEffect, useRef, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';
import { authenticationError, initializeAuthentication } from '../lib/auth';
import { desktopSignInTarget } from '../lib/desktopAuth';

export { isDesktopSignInRequest } from '../lib/desktopAuth';

export function DesktopSignIn() {
  const [target] = useState(() => {
    try { return desktopSignInTarget(window.location); } catch { return null; }
  });
  const [auth, setAuth] = useState<Auth | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [credential, setCredential] = useState<{ token: string; email: string } | null>(null);
  const [expired, setExpired] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let active = true;
    if (!target) return;
    history.replaceState(null, '', `${location.pathname}${location.search}#desktopLogin=1`);
    const existingPolicy = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    const previousPolicy = existingPolicy?.content;
    const policy = existingPolicy ?? document.createElement('meta');
    policy.name = 'referrer';
    policy.content = 'origin';
    if (!existingPolicy) document.head.append(policy);
    initializeAuthentication().then((value) => { if (active) setAuth(value); }).catch((failure: unknown) => {
      if (active) setError(authenticationError(failure));
    });
    const expire = () => { setExpired(true); setCredential(null); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) expire(); };
    const timer = window.setTimeout(expire, 5 * 60 * 1000);
    window.addEventListener('pageshow', restored);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('pageshow', restored);
      if (existingPolicy) existingPolicy.content = previousPolicy || '';
      else policy.remove();
    };
  }, [target]);

  useEffect(() => {
    if (credential) form.current?.requestSubmit();
  }, [credential]);

  const signIn = async () => {
    if (!auth || pending || expired) return;
    setPending(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const token = GoogleAuthProvider.credentialFromResult(result)?.idToken;
      if (!token) throw new Error('auth/invalid-credential');
      setCredential({ token, email: result.user.email || result.user.displayName || 'Tài khoản Google' });
    } catch (failure) {
      setError(authenticationError(failure));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="desktop-login-title" aria-describedby="desktop-login-intro">
        <header className="auth-head">
          <img className="auth-logo" src="/logo-icon.png" alt="" width="64" height="64" />
          <div className="auth-title">
            <h1 id="desktop-login-title">Đăng nhập Minh Spark Office</h1>
            <p className="auth-intro" id="desktop-login-intro">
              {!target || expired
                ? 'Yêu cầu đăng nhập không hợp lệ hoặc đã hết hạn.'
                : 'Đăng nhập cùng tài khoản Google để mở chung kho tài liệu trên web và ứng dụng máy tính.'}
            </p>
          </div>
        </header>
        {!target || expired ? (
          <p className="auth-error" role="alert">Hãy quay lại ứng dụng trên máy tính và bấm đăng nhập lại.</p>
        ) : (
          <div className="auth-body">
            {error && <p className="auth-error" role="alert">{error}</p>}
            {credential ? (
              <form ref={form} method="post" action={target.action} target="_self" encType="application/x-www-form-urlencoded" autoComplete="off" className="auth-buttons">
                <input type="hidden" name="state" value={target.state} />
                <input type="hidden" name="idToken" value={credential.token} />
                <p className="auth-status" role="status">Đang chuyển {credential.email} về ứng dụng…</p>
                <button className="btn btn-primary auth-wide" type="submit">Chuyển về ứng dụng</button>
              </form>
            ) : (
              <div className="auth-buttons">
                <button className="btn auth-google google-signin" disabled={!auth || pending} onClick={() => void signIn()}>
                  <img src="/google.svg" width="20" height="20" alt="" />{pending ? 'Đang chờ Google…' : 'Đăng nhập bằng Google'}
                </button>
              </div>
            )}
            <p className="auth-disclosure">Chỉ tiếp tục nếu yêu cầu này được mở từ Minh Spark Office trên máy tính này. Không yêu cầu quyền đọc Gmail hoặc Google Drive.</p>
          </div>
        )}
      </section>
    </main>
  );
}
