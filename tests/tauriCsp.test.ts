import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { videoEmbedUrl } from '../src/editors/doc/insertNodes';

const config = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const csp: string = config.app.security.csp;
const frameSources = (/frame-src ([^;]*)/.exec(csp)?.[1] ?? '').split(/\s+/);

test('the desktop app allows every video host the editor embeds', () => {
  const samples = ['https://www.youtube.com/watch?v=xwnv4J66Ndc', 'https://youtu.be/xwnv4J66Ndc', 'https://vimeo.com/76979871'];
  for (const sample of samples) {
    const embed = videoEmbedUrl(sample);
    assert.ok(embed, sample);
    assert.ok(frameSources.includes(new URL(embed).origin), `${new URL(embed).origin} missing from frame-src`);
  }
});
