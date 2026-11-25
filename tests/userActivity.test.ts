import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_INSTALL_IDLE_MS, activitySnapshot, autoInstallDecision, markPresenting, trackUserActivity } from '../src/lib/userActivity';

const base = { hasDocuments: true, idleMs: 0, presenting: false, postponedUntil: 0, now: 1_000_000 };

test('installs right away when no document is open', () => {
  assert.equal(autoInstallDecision({ ...base, hasDocuments: false }), 'install');
});

test('with documents open, installs only after the user has been idle long enough', () => {
  assert.equal(autoInstallDecision({ ...base, idleMs: AUTO_INSTALL_IDLE_MS - 1 }), 'wait');
  assert.equal(autoInstallDecision({ ...base, idleMs: AUTO_INSTALL_IDLE_MS }), 'install');
});

test('never installs during a slideshow or while postponed', () => {
  assert.equal(autoInstallDecision({ ...base, hasDocuments: false, presenting: true }), 'wait');
  assert.equal(autoInstallDecision({ ...base, hasDocuments: false, postponedUntil: base.now + 1 }), 'wait');
  assert.equal(autoInstallDecision({ ...base, hasDocuments: false, postponedUntil: base.now }), 'install');
});

test('input in a tab frame resets idle time and presenting is tracked on the top window', () => {
  const listeners = new Map<string, () => void>();
  const top = { addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as Window;
  (top as unknown as { top: Window }).top = top;
  const frame = { top, addEventListener: (type: string, fn: () => void) => listeners.set(type, fn), removeEventListener: () => undefined } as unknown as Window;
  const state = (top as unknown as Record<string, { lastInput: number }>);
  trackUserActivity(frame);
  activitySnapshot(frame);
  state.__officeUserActivity.lastInput = 0;
  assert.ok(activitySnapshot(top, 500_000).idleMs >= 500_000);
  listeners.get('keydown')?.();
  assert.ok(activitySnapshot(top).idleMs < 1_000);
  const stop = markPresenting(frame);
  assert.equal(activitySnapshot(top).presenting, true);
  stop();
  assert.equal(activitySnapshot(top).presenting, false);
});
