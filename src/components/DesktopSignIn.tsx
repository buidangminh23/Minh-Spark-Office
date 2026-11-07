import { useEffect, useState } from 'react';
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
    const timer = window.setTimeout(() => { setExpired(true); setCredential(null); }, 5 * 60 * 1000);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (existingPolicy) existingPolicy.content = previousPolicy || '';
      else policy.remove();
    };
  }, [target]);

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
    <main className="dialog-backdrop">
      <section className="dialog" aria-labelledby="desktop-login-title">
        <h1 id="desktop-login-title">Đăng nhập Minh Spark Office</h1>
        {!target || expired ? (
          <p role="alert">Yêu cầu đăng nhập không hợp lệ hoặc đã hết hạn. Hãy quay lại ứng dụng trên máy tính và đăng nhập lại.</p>
        ) : (
          <>
            <p className="dialog-subtitle">Đăng nhập cùng tài khoản Google để mở chung kho tài liệu trên web và ứng dụng máy tính.</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {credential ? (
              <form method="post" action={target.action} target="_self" encType="application/x-www-form-urlencoded" autoComplete="off">
                <input type="hidden" name="state" value={target.state} />
                <input type="hidden" name="idToken" value={credential.token} />
                <p>Tiếp tục trong ứng dụng máy tính với {credential.email}.</p>
                <div className="dialog-actions">
                  <button className="btn" type="button" onClick={() => setCredential(null)}>Đổi tài khoản</button>
                  <button className="btn btn-primary" type="submit">Hoàn tất đăng nhập ứng dụng</button>
                </div>
              </form>
            ) : (
              <div className="dialog-actions">
                <button className="btn btn-primary google-signin" disabled={!auth || pending} onClick={() => void signIn()}>
                  <img src="/google.svg" width="20" height="20" alt="" />{pending ? 'Đang chờ Google…' : 'Đăng nhập bằng Google'}
                </button>
              </div>
            )}
            <p className="auth-disclosure">Chỉ hoàn tất nếu yêu cầu này được mở từ Minh Spark Office trên máy tính này. Không yêu cầu quyền đọc Gmail hoặc Google Drive.</p>
          </>
        )}
      </section>
    </main>
  );
}
