import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, browserPopupRedirectResolver, browserSessionPersistence, connectAuthEmulator, getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const authConfigured = Object.values(config).every((value) => typeof value === 'string' && value.trim());

const AUTH_EMULATOR_FLAG = 'office-auth-emulator';

let authentication: Promise<Auth> | null = null;

function devEmulator(name: 'auth' | 'firestore') {
  if (!import.meta.env.DEV) return '';
  const target = String((name === 'auth' ? import.meta.env.VITE_AUTH_EMULATOR : import.meta.env.VITE_FIRESTORE_EMULATOR) ?? '');
  if (!target || name === 'firestore') return target;
  try {
    if (new URLSearchParams(window.location.search).has('authEmu')) sessionStorage.setItem(AUTH_EMULATOR_FLAG, '1');
    return sessionStorage.getItem(AUTH_EMULATOR_FLAG) ? target : '';
  } catch {
    return '';
  }
}

async function connectDevEmulators(app: ReturnType<typeof getApp>, auth: Auth, fresh: boolean) {
  if (!fresh) return;
  const authTarget = devEmulator('auth');
  if (authTarget) connectAuthEmulator(auth, `http://${authTarget}`, { disableWarnings: true });
  const firestore = devEmulator('firestore');
  if (!firestore) return;
  const { connectFirestoreEmulator, getFirestore } = await import('firebase/firestore');
  const [host, port] = firestore.split(':');
  connectFirestoreEmulator(getFirestore(app), host, Number(port));
}

export function initializeAuthentication(): Promise<Auth> {
  if (!authConfigured) return Promise.reject(new Error('auth/missing-config'));
  authentication ??= (async () => {
    const fresh = !getApps().length;
    const app = fresh ? initializeApp(config) : getApp();
    const emulated = Boolean(devEmulator('auth'));
    let auth: Auth;
    try {
      auth = initializeAuth(app, { persistence: emulated ? [browserSessionPersistence] : [browserLocalPersistence, indexedDBLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver });
    } catch {
      auth = getAuth(app);
    }
    if (import.meta.env.DEV) await connectDevEmulators(app, auth, fresh);
    auth.languageCode = 'vi';
    await auth.authStateReady();
    return auth;
  })().catch((error: unknown) => {
    authentication = null;
    throw error;
  });
  return authentication;
}

export function authenticationError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    'auth/missing-config': 'Đăng nhập Google chưa được cấu hình. Vẫn có thể mở tài liệu đã lưu trên máy này.',
    'auth/popup-closed-by-user': 'Cửa sổ Google đã đóng trước khi hoàn tất đăng nhập. Có thể thử lại.',
    'auth/cancelled-popup-request': 'Một cửa sổ đăng nhập khác đang mở. Hãy hoàn tất tại cửa sổ Google.',
    'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ Google. Hãy cho phép cửa sổ bật lên cho trang này rồi thử lại.',
    'auth/network-request-failed': 'Không kết nối được với Google. Hãy kiểm tra mạng rồi thử lại.',
    'auth/unauthorized-domain': 'Tên miền này chưa được cho phép đăng nhập. Vui lòng liên hệ quản trị viên.',
    'auth/operation-not-allowed': 'Đăng nhập Google chưa được bật. Vui lòng liên hệ quản trị viên.',
    'auth/user-disabled': 'Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
    'auth/too-many-requests': 'Có quá nhiều lần đăng nhập. Vui lòng đợi một lát rồi thử lại.',
    'auth/web-storage-unsupported': 'Trình duyệt đang chặn lưu phiên đăng nhập. Hãy cho phép dữ liệu trang web rồi thử lại.',
    'auth/account-exists-with-different-credential': 'Email này đã dùng một phương thức đăng nhập khác. Vui lòng liên hệ quản trị viên.',
  };
  return messages[code] ?? 'Không thể hoàn tất đăng nhập. Vui lòng thử lại sau.';
}
