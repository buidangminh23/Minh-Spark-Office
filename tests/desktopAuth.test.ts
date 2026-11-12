import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDesktopKeyPair,
  desktopLoginDocumentId,
  desktopPairingCode,
  desktopSignInRequest,
  desktopSignInUrl,
  exportDesktopPublicKey,
  fromBase64Url,
  googleTokenAccount,
  openFromBrowser,
  sealForDesktop,
  toBase64Url,
} from '../src/lib/desktopAuth.ts';

const origin = 'https://office.minhspark.com';
const sampleToken = `${toBase64Url(new TextEncoder().encode('{"alg":"RS256"}'))}.${toBase64Url(new TextEncoder().encode(JSON.stringify({ email: 'minh@example.com', exp: 4_102_444_800 })))}.signature`;

test('the browser link carries only the app public key and round-trips through the parser', async () => {
  const keys = await createDesktopKeyPair();
  const publicKey = await exportDesktopPublicKey(keys.publicKey);
  assert.match(publicKey, /^B[A-Za-z0-9_-]{86}$/);
  const url = new URL(desktopSignInUrl(publicKey));
  assert.equal(url.origin, origin);
  assert.deepEqual(desktopSignInRequest({ origin: url.origin, hash: url.hash }), { publicKey });
});

test('sign-in links from untrusted origins, old apps and malformed keys are refused', () => {
  const key = `B${'a'.repeat(86)}`;
  for (const candidate of ['https://attacker.test', 'https://office.minhspark.com.attacker.test', 'http://office.minhspark.com']) {
    assert.throws(() => desktopSignInRequest({ origin: candidate, hash: `#desktopLogin=2&key=${key}` }), /invalid-request/);
  }
  assert.throws(() => desktopSignInRequest({ origin, hash: `#desktopLogin=1&port=49152&state=${'a'.repeat(64)}` }), /desktop-outdated/);
  for (const hash of [
    '#desktopLogin=2', `#key=${key}`, `#desktopLogin=2&key=${key.slice(1)}`, `#desktopLogin=2&key=A${'a'.repeat(86)}`,
    `#desktopLogin=2&key=${key}&key=${key}`, `#desktopLogin=2&desktopLogin=2&key=${key}`, `#desktopLogin=3&key=${key}`,
  ]) assert.throws(() => desktopSignInRequest({ origin, hash }), /invalid-request/, hash);
});

test('only the app that holds the private key can open the sealed token', async () => {
  const app = await createDesktopKeyPair();
  const publicKey = await exportDesktopPublicKey(app.publicKey);
  const envelope = await sealForDesktop(publicKey, sampleToken);
  assert.ok(!envelope.ciphertext.includes(sampleToken.split('.')[1]));
  assert.equal(await openFromBrowser(app, envelope), sampleToken);

  const stranger = await createDesktopKeyPair();
  await assert.rejects(openFromBrowser(stranger, envelope), /invalid-payload/);

  const tampered = fromBase64Url(envelope.ciphertext);
  tampered[0] ^= 1;
  await assert.rejects(openFromBrowser(app, { ...envelope, ciphertext: toBase64Url(tampered) }), /invalid-payload/);

  const other = await exportDesktopPublicKey((await createDesktopKeyPair()).publicKey);
  await assert.rejects(openFromBrowser(app, await sealForDesktop(other, sampleToken)), /invalid-payload/);
});

test('both sides derive the same document id and pairing code from the public key', async () => {
  const publicKey = await exportDesktopPublicKey((await createDesktopKeyPair()).publicKey);
  assert.match(await desktopLoginDocumentId(publicKey), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await desktopLoginDocumentId(publicKey), await desktopLoginDocumentId(publicKey));
  assert.match(await desktopPairingCode(publicKey), /^\d{3} \d{3}$/);
  const another = await exportDesktopPublicKey((await createDesktopKeyPair()).publicKey);
  assert.notEqual(await desktopLoginDocumentId(publicKey), await desktopLoginDocumentId(another));
});

test('the app reads the account email from the delivered token for confirmation', () => {
  assert.deepEqual(googleTokenAccount(sampleToken), { email: 'minh@example.com', expiresAt: 4_102_444_800_000 });
  assert.throws(() => googleTokenAccount('not-a-token'), /invalid-payload/);
  assert.throws(() => googleTokenAccount(`a.${toBase64Url(new TextEncoder().encode('{}'))}.c`), /invalid-payload/);
});
