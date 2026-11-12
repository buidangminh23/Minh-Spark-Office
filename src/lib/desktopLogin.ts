import type { Auth } from 'firebase/auth';
import {
  DESKTOP_LOGIN_COLLECTION,
  DESKTOP_LOGIN_TTL_MS,
  createDesktopKeyPair,
  desktopLoginDocumentId,
  desktopPairingCode,
  exportDesktopPublicKey,
  googleTokenAccount,
  openFromBrowser,
} from './desktopAuth';
import { focusDesktopWindow, openDesktopSignIn } from './desktop';

const POLL_MS = 2000;
const CLOCK_SKEW_MS = 60_000;

export type DesktopLoginResult = { idToken: string; email: string };

export type DesktopLogin = { code: string; result: Promise<DesktopLoginResult> };

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new Error('auth/desktop-cancelled')); }, { once: true });
  });
}

export async function beginDesktopLogin(auth: Auth, signal: AbortSignal): Promise<DesktopLogin> {
  const keys = await createDesktopKeyPair();
  const publicKey = await exportDesktopPublicKey(keys.publicKey);
  const [id, code] = await Promise.all([desktopLoginDocumentId(publicKey), desktopPairingCode(publicKey)]);
  const firestore = await import('firebase/firestore');
  const reference = firestore.doc(firestore.getFirestore(auth.app), DESKTOP_LOGIN_COLLECTION, id);
  const started = Date.now();
  await openDesktopSignIn(publicKey);

  const result = (async () => {
    while (Date.now() - started < DESKTOP_LOGIN_TTL_MS) {
      if (signal.aborted) throw new Error('auth/desktop-cancelled');
      const snapshot = await firestore.getDocFromServer(reference).catch(() => null);
      if (snapshot?.exists()) {
        await firestore.deleteDoc(reference).catch(() => undefined);
        const data = snapshot.data();
        const createdAt = data.createdAt?.toMillis?.() ?? 0;
        if (createdAt < started - CLOCK_SKEW_MS || createdAt > started + DESKTOP_LOGIN_TTL_MS + CLOCK_SKEW_MS) throw new Error('auth/desktop-invalid-payload');
        const idToken = await openFromBrowser(keys, { ephemeralKey: String(data.ephemeralKey), iv: String(data.iv), ciphertext: String(data.ciphertext) });
        const account = googleTokenAccount(idToken);
        if (account.expiresAt && account.expiresAt < Date.now()) throw new Error('auth/desktop-timeout');
        await focusDesktopWindow();
        return { idToken, email: account.email };
      }
      await pause(POLL_MS, signal);
    }
    throw new Error('auth/desktop-timeout');
  })();
  return { code, result };
}
