import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EDITOR_LOADING_Z_INDEX } from '../src/lib/layers';

const zIndexOf = (css: string, selector: string) => {
  const lines = css.split(/\r?\n/);
  const first = lines.findIndex((line) => line.trim() === `${selector} {`);
  if (first < 0) return Number.NaN;
  for (const line of lines.slice(first + 1)) {
    if (line.trim() === '}') break;
    const match = /^\s*z-index:\s*(\d+);/.exec(line);
    if (match) return Number(match[1]);
  }
  return Number.NaN;
};

test('the editor loading screen stays under dialogs so a tab can still ask the user', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const dialog = zIndexOf(css, '.dialog-backdrop');
  assert.ok(Number.isFinite(dialog), 'dialog-backdrop z-index not found');
  assert.ok(EDITOR_LOADING_Z_INDEX < dialog, `loading ${EDITOR_LOADING_Z_INDEX} must be below dialogs ${dialog}`);
});

test('App renders the loading screen with the shared layer constant', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /aria-label="Đang tải trình soạn thảo"[^>]*zIndex: EDITOR_LOADING_Z_INDEX/);
});
