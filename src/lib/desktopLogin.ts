import type { Auth } from 'firebase/auth';
import {
  DESKTOP_LOGIN_COLLECTION,
  DESKTOP_LOGIN_TTL_MS,
  createDesktopKeyPair,
  desktopLoginDocumentId,
  exportDesktopPublicKey,
  googleTokenAccount,
  openFromBrowser,
} from './desktopAuth';
import { focusDesktopWindow, openDesktopSignIn } from './desktop';

const POLL_MS = 2000;
const CLOCK_SKEW_MS = 60_000;

export type DesktopLoginResult = { idToken: string; email: string };

export type DesktopLogin = { result: Promise<DesktopLoginResult> };

export async function beginDesktopLogin(auth: Auth, signal: AbortSignal): Promise<DesktopLogin> {
  const keys = await createDesktopKeyPair();
  const publicKey = await exportDesktopPublicKey(keys.publicKey);
  const id = await desktopLoginDocumentId(publicKey);
  const firestore = await import('firebase/firestore');
  const reference = firestore.doc(firestore.getFirestore(auth.app), DESKTOP_LOGIN_COLLECTION, id);
  const started = Date.now();
  await openDesktopSignIn(publicKey);

  const result = new Promise<DesktopLoginResult>((resolve, reject) => {
    let settled = false;
    let checking = false;
    let timer = 0;
    let stopListening: () => void = () => undefined;
    const cleanup = () => {
      settled = true;
      window.clearTimeout(timer);
      stopListening();
      document.removeEventListener('visibilitychange', checkNow);
      window.removeEventListener('focus', checkNow);
      signal.removeEventListener('abort', cancel);
    };
    const fail = (error: Error) => { if (!settled) { cleanup(); reject(error); } };
    const cancel = () => fail(new Error('auth/desktop-cancelled'));
    const accept = async (data: Record<string, unknown>) => {
      if (settled) return;
      cleanup();
      try {
        await firestore.deleteDoc(reference).catch(() => undefined);
        const createdAt = (data.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        if (createdAt < started - CLOCK_SKEW_MS || createdAt > started + DESKTOP_LOGIN_TTL_MS + CLOCK_SKEW_MS) throw new Error('auth/desktop-invalid-payload');
        const idToken = await openFromBrowser(keys, { ephemeralKey: String(data.ephemeralKey), iv: String(data.iv), ciphertext: String(data.ciphertext) });
        const account = googleTokenAccount(idToken);
        if (account.expiresAt && account.expiresAt < Date.now()) throw new Error('auth/desktop-timeout');
        await focusDesktopWindow();
        resolve({ idToken, email: account.email });
      } catch (error) {
        reject(error instanceof Error ? error : new Error('auth/desktop-invalid-payload'));
      }
    };
    async function checkNow() {
      if (settled || checking) return;
      if (Date.now() - started >= DESKTOP_LOGIN_TTL_MS) { fail(new Error('auth/desktop-timeout')); return; }
      checking = true;
      const snapshot = await firestore.getDocFromServer(reference).catch(() => null);
      checking = false;
      if (snapshot?.exists()) await accept(snapshot.data());
    }
    const poll = () => {
      if (settled) return;
      void checkNow().finally(() => { if (!settled) timer = window.setTimeout(poll, POLL_MS); });
    };
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    document.addEventListener('visibilitychange', checkNow);
    window.addEventListener('focus', checkNow);
    stopListening = firestore.onSnapshot(reference, (snapshot) => {
      if (snapshot.exists() && !snapshot.metadata.fromCache) void accept(snapshot.data());
    }, () => undefined);
    timer = window.setTimeout(poll, POLL_MS);
  });
  return { result };
}
