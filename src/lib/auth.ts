import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, browserSessionPersistence, connectAuthEmulator, getAuth, setPersistence } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const AUTH_EMULATOR_FLAG = 'office-auth-emulator';

let emulatorReady: Promise<void> | null = null;

export const authConfigured = Object.values(config).every((value) => typeof value === 'string' && value.trim());

function devAuthEmulator() {
  if (!import.meta.env.DEV) return '';
  const target = String(import.meta.env.VITE_AUTH_EMULATOR ?? '');
  if (!target) return '';
  try {
    if (new URLSearchParams(window.location.search).has('authEmu')) sessionStorage.setItem(AUTH_EMULATOR_FLAG, '1');
    return sessionStorage.getItem(AUTH_EMULATOR_FLAG) ? target : '';
  } catch {
    return '';
  }
}

export async function initializeAuthentication() {
  if (!authConfigured) throw new Error('auth/missing-config');
  const fresh = !getApps().length;
  const app = fresh ? initializeApp(config) : getApp();
  const firestoreEmulator = import.meta.env.DEV ? String(import.meta.env.VITE_FIRESTORE_EMULATOR ?? '') : '';
  if (fresh && firestoreEmulator) {
    emulatorReady = import('firebase/firestore').then(({ connectFirestoreEmulator, getFirestore }) => {
      const [host, port] = firestoreEmulator.split(':');
      connectFirestoreEmulator(getFirestore(app), host, Number(port));
    });
  }
  await emulatorReady;
  const auth = getAuth(app);
  const authEmulator = devAuthEmulator();
  if (fresh && authEmulator) connectAuthEmulator(auth, `http://${authEmulator}`, { disableWarnings: true });
  auth.languageCode = 'vi';
  await setPersistence(auth, authEmulator ? browserSessionPersistence : browserLocalPersistence);
  return auth;
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
