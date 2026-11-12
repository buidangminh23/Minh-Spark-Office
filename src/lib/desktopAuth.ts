const hostedOrigin = 'https://office.minhspark.com';
const PROTOCOL_VERSION = '2';
const PUBLIC_KEY_PATTERN = /^B[A-Za-z0-9_-]{86}$/;
const HKDF_INFO = new TextEncoder().encode('minhspark-office-desktop-login-v2');

export const DESKTOP_LOGIN_COLLECTION = 'desktopLogins';
export const DESKTOP_LOGIN_TTL_MS = 5 * 60 * 1000;

export type DesktopLoginEnvelope = { ephemeralKey: string; iv: string; ciphertext: string };

export function isDesktopSignInRequest() {
  return new URLSearchParams(window.location.hash.slice(1)).has('desktopLogin');
}

export function desktopSignInRequest(location: Pick<Location, 'origin' | 'hash'>) {
  if (location.origin !== hostedOrigin) throw new Error('auth/desktop-invalid-request');
  const params = new URLSearchParams(location.hash.slice(1));
  const versions = params.getAll('desktopLogin');
  if (versions.length === 1 && versions[0] === '1') throw new Error('auth/desktop-outdated');
  const key = params.get('key') || '';
  if (versions.length !== 1 || versions[0] !== PROTOCOL_VERSION || params.getAll('key').length !== 1 || !PUBLIC_KEY_PATTERN.test(key)) {
    throw new Error('auth/desktop-invalid-request');
  }
  return { publicKey: key };
}

export function desktopSignInUrl(publicKey: string) {
  if (!PUBLIC_KEY_PATTERN.test(publicKey)) throw new Error('auth/desktop-invalid-request');
  return `${hostedOrigin}/#desktopLogin=${PROTOCOL_VERSION}&key=${publicKey}`;
}

export function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('auth/desktop-invalid-payload');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function digest(publicKey: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', fromBase64Url(publicKey)));
}

export async function desktopLoginDocumentId(publicKey: string) {
  return toBase64Url(await digest(publicKey));
}

export async function desktopPairingCode(publicKey: string) {
  const bytes = await digest(publicKey);
  const value = new DataView(bytes.buffer).getUint32(28) % 1_000_000;
  const text = String(value).padStart(6, '0');
  return `${text.slice(0, 3)} ${text.slice(3)}`;
}

export async function createDesktopKeyPair() {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

export async function exportDesktopPublicKey(key: CryptoKey) {
  return toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

async function importPublicKey(publicKey: string) {
  return crypto.subtle.importKey('raw', fromBase64Url(publicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

async function sessionKey(privateKey: CryptoKey, peer: CryptoKey, salt: Uint8Array<ArrayBuffer>, usage: KeyUsage) {
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, privateKey, 256);
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO }, material, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

export async function sealForDesktop(publicKey: string, idToken: string): Promise<DesktopLoginEnvelope> {
  const salt = await digest(publicKey);
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const key = await sessionKey(ephemeral.privateKey, await importPublicKey(publicKey), salt, 'encrypt');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: salt }, key, new TextEncoder().encode(idToken));
  return { ephemeralKey: await exportDesktopPublicKey(ephemeral.publicKey), iv: toBase64Url(iv), ciphertext: toBase64Url(new Uint8Array(ciphertext)) };
}

export async function openFromBrowser(keyPair: CryptoKeyPair, envelope: DesktopLoginEnvelope) {
  if (!PUBLIC_KEY_PATTERN.test(envelope.ephemeralKey)) throw new Error('auth/desktop-invalid-payload');
  const salt = await digest(await exportDesktopPublicKey(keyPair.publicKey));
  const key = await sessionKey(keyPair.privateKey, await importPublicKey(envelope.ephemeralKey), salt, 'decrypt');
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(envelope.iv), additionalData: salt }, key, fromBase64Url(envelope.ciphertext));
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('auth/desktop-invalid-payload');
  }
}

export function googleTokenAccount(idToken: string) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('auth/desktop-invalid-payload');
  const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1]))) as { email?: unknown; exp?: unknown };
  if (typeof claims.email !== 'string' || !claims.email) throw new Error('auth/desktop-invalid-payload');
  return { email: claims.email, expiresAt: typeof claims.exp === 'number' ? claims.exp * 1000 : 0 };
}
