import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isShareableFileId, settleWithin } from '../src/lib/teamShare';

describe('team share requests', () => {
  it('does not offer to re-share a document that already lives in a team', () => {
    assert.equal(isShareableFileId('doc-1731400000000'), true);
    assert.equal(isShareableFileId('team.AAAA.BBBB'), false);
    assert.equal(isShareableFileId(''), false);
  });

  it('stops waiting for a save that never settles', async () => {
    const started = performance.now();
    const result = await settleWithin(new Promise<boolean>(() => undefined), false, 30);
    assert.equal(result, false);
    assert.ok(performance.now() - started < 1000);
  });

  it('returns the save result when it settles in time and survives a rejected save', async () => {
    assert.equal(await settleWithin(Promise.resolve(true), false, 1000), true);
    assert.equal(await settleWithin(Promise.reject(new Error('boom')), false, 1000), false);
  });
});
