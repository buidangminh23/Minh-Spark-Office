import assert from 'node:assert/strict';
import { test } from 'node:test';
import { desktopSignInTarget } from '../src/lib/desktopAuth.ts';

const state = 'a'.repeat(64);
const origin = 'https://office.minhspark.com';

test('desktop callback only targets an ephemeral loopback port with valid state', () => {
  assert.deepEqual(desktopSignInTarget({ origin, hash: `#desktopLogin=1&port=49152&state=${state}` }), {
    action: 'http://127.0.0.1:49152/callback', state,
  });
});

test('desktop login rejects untrusted origins and malformed callback targets', () => {
  for (const candidate of ['https://attacker.test', 'https://office.minhspark.com.attacker.test', 'http://office.minhspark.com']) {
    assert.throws(() => desktopSignInTarget({ origin: candidate, hash: `#desktopLogin=1&port=49152&state=${state}` }));
  }
  for (const port of ['0', '80', '65536', 'localhost:1234', '12/foo', '12.2', '1234@attacker.test']) {
    assert.throws(() => desktopSignInTarget({ origin, hash: `#desktopLogin=1&port=${port}&state=${state}` }));
  }
  for (const hash of [
    '#desktopLogin=1', `#port=49152&state=${state}`, `#desktopLogin=1&port=49152&state=short`,
    `#desktopLogin=1&port=49152&port=49153&state=${state}`, `#desktopLogin=1&port=49152&state=${state}&state=${state}`,
    `#desktopLogin=1&desktopLogin=1&port=49152&state=${state}`,
  ]) assert.throws(() => desktopSignInTarget({ origin, hash }));
});
