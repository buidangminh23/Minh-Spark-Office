import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

type LockedPackage = { name?: string; version?: string; source?: string };

function lockedPackages(): LockedPackage[] {
  const [packages] = read('src-tauri/Cargo.lock').split('\n[[patch.unused]]');
  return packages.split('\n[[package]]\n').slice(1).map((block) => ({
    name: block.match(/^name = "(.+)"$/m)?.[1],
    version: block.match(/^version = "(.+)"$/m)?.[1],
    source: block.match(/^source = "(.+)"$/m)?.[1],
  }));
}

function atLeast(version: string, minimum: string) {
  const [have, want] = [version, minimum].map((text) => text.split(/[.+-]/).slice(0, 3).map(Number));
  const index = have.findIndex((part, position) => part !== want[position]);
  return index === -1 || have[index] > want[index];
}

describe('glib (GHSA-wrw7-89jp-8q8g)', () => {
  const glib = lockedPackages().filter((pkg) => pkg.name === 'glib');

  test('never builds a crates.io glib that still has the unsound VariantStrIter', () => {
    const unsound = glib.filter((pkg) => pkg.source?.startsWith('registry+') && !atLeast(pkg.version ?? '0.0.0', '0.20.0'));
    assert.deepEqual(unsound, [], 'keep [patch.crates-io] glib pointing at src-tauri/third_party/glib while anything needs glib 0.18');
  });

  test('builds the vendored glib only with the upstream fix and only while something needs it', () => {
    const vendored = glib.filter((pkg) => pkg.source === undefined);
    if (vendored.length === 0) {
      assert.equal(existsSync('src-tauri/third_party/glib'), false, 'nothing needs glib 0.18 any more: delete src-tauri/third_party/glib and the [patch.crates-io] entry');
      return;
    }
    const source = read('src-tauri/third_party/glib/src/variant_iter.rs');
    const body = source.slice(source.indexOf('fn impl_get'), source.indexOf('fn impl_get') + 600);
    assert.match(body, /&mut p,/);
    assert.doesNotMatch(body, /\n\s*&p,/);
  });
});
