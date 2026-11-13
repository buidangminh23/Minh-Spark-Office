import { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';
import { authenticationError, initializeAuthentication } from '../lib/auth';
import { DESKTOP_LOGIN_COLLECTION, DESKTOP_LOGIN_TTL_MS, desktopLoginDocumentId, desktopPairingCode, desktopSignInRequest, sealForDesktop } from '../lib/desktopAuth';

export { isDesktopSignInRequest } from '../lib/desktopAuth';

const DELIVERY_LIFETIME_MS = 10 * 60 * 1000;

type Request = { publicKey: string } | { failure: 'outdated' | 'invalid' };

function readRequest(): Request {
  try {
    return desktopSignInRequest(window.location);
  } catch (error) {
    return { failure: error instanceof Error && error.message === 'auth/desktop-outdated' ? 'outdated' : 'invalid' };
  }
}

async function deliver(auth: Auth, publicKey: string, idToken: string) {
  const { doc, getFirestore, serverTimestamp, setDoc, Timestamp } = await import('firebase/firestore');
  const envelope = await sealForDesktop(publicKey, idToken);
  const id = await desktopLoginDocumentId(publicKey);
  await setDoc(doc(getFirestore(auth.app), DESKTOP_LOGIN_COLLECTION, id), { ...envelope, createdAt: serverTimestamp(), expireAt: Timestamp.fromMillis(Date.now() + DELIVERY_LIFETIME_MS) });
}

function deliveryError(failure: unknown) {
  const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : '';
  if (code === 'permission-denied') return 'Yêu cầu đăng nhập này đã được dùng. Hãy bấm đăng nhập lại trong ứng dụng trên máy tính.';
  if (code === 'unavailable') return 'Không gửi được tài khoản về ứng dụng vì mất kết nối. Hãy kiểm tra mạng rồi thử lại.';
  return authenticationError(failure);
}

export function DesktopSignIn() {
  const [request] = useState(readRequest);
  const [code, setCode] = useState('');
  const [auth, setAuth] = useState<Auth | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [expired, setExpired] = useState(false);
  const publicKey = 'publicKey' in request ? request.publicKey : '';

  useEffect(() => {
    if (!publicKey) return;
    let active = true;
    desktopPairingCode(publicKey).then((value) => { if (active) setCode(value); }).catch(() => { if (active) setError('Trình duyệt này không hỗ trợ mã hoá cần cho đăng nhập.'); });
    initializeAuthentication().then((value) => { if (active) setAuth(value); }).catch((failure: unknown) => {
      if (active) setError(authenticationError(failure));
    });
    const timer = window.setTimeout(() => setExpired(true), DESKTOP_LOGIN_TTL_MS);
    return () => { active = false; window.clearTimeout(timer); };
  }, [publicKey]);

  const signIn = async () => {
    if (!auth || !publicKey || pending || expired || sentTo) return;
    setPending(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const token = GoogleAuthProvider.credentialFromResult(result)?.idToken;
      if (!token) throw new Error('auth/invalid-credential');
      await deliver(auth, publicKey, token);
      setSentTo(result.user.email || result.user.displayName || 'Tài khoản Google');
    } catch (failure) {
      setError(deliveryError(failure));
    } finally {
      setPending(false);
    }
  };

  const intro = 'failure' in request
    ? request.failure === 'outdated'
      ? 'Ứng dụng Office 23 trên máy tính đang dùng bản cũ.'
      : 'Yêu cầu đăng nhập không hợp lệ.'
    : expired ? 'Yêu cầu đăng nhập đã hết hạn.'
    : 'Đăng nhập cùng tài khoản Google để mở chung kho tài liệu trên web và ứng dụng máy tính.';

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="desktop-login-title" aria-describedby="desktop-login-intro">
        <header className="auth-head">
          <img className="auth-logo" src="/logo-icon.png" alt="" width="64" height="64" />
          <div className="auth-title">
            <h1 id="desktop-login-title">Đăng nhập Office 23</h1>
            <p className="auth-intro" id="desktop-login-intro">{intro}</p>
          </div>
        </header>
        {'failure' in request ? (
          <p className="auth-error" role="alert">
            {request.failure === 'outdated'
              ? 'Hãy mở ứng dụng, đợi ứng dụng tự cập nhật lên bản mới rồi bấm đăng nhập lại.'
              : 'Hãy quay lại ứng dụng trên máy tính và bấm đăng nhập lại.'}
          </p>
        ) : expired && !sentTo ? (
          <p className="auth-error" role="alert">Hãy quay lại ứng dụng trên máy tính và bấm đăng nhập lại.</p>
        ) : sentTo ? (
          <div className="auth-body">
            <p className="auth-status" role="status">Đã gửi {sentTo} về ứng dụng. Hãy xác nhận trong cửa sổ Office 23, rồi có thể đóng tab này.</p>
          </div>
        ) : (
          <div className="auth-body">
            <div className="auth-pairing" aria-live="polite">
              <span>Mã xác nhận</span>
              <strong>{code || '··· ···'}</strong>
            </div>
            <p className="auth-disclosure">Chỉ tiếp tục nếu cửa sổ Office 23 trên máy tính đang hiện đúng mã này. Nếu ứng dụng không hiện mã, hoặc mã khác, hãy đóng tab này.</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="auth-buttons">
              <button className="btn auth-google google-signin" disabled={!auth || !code || pending} onClick={() => void signIn()}>
                <img src="/google.svg" width="20" height="20" alt="" />{pending ? 'Đang chờ Google…' : 'Mã khớp, đăng nhập bằng Google'}
              </button>
            </div>
            <p className="auth-disclosure">Tài khoản được mã hoá trước khi gửi, chỉ ứng dụng đã mở trang này mới giải mã được. Không yêu cầu quyền đọc Gmail hoặc Google Drive.</p>
          </div>
        )}
      </section>
    </main>
  );
}
