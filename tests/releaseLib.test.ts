import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  VERSION_FILES,
  bumpVersionText,
  missingPlatforms,
  nextPatchVersion,
  parseChecksums,
  releaseArtifactNames,
  retainedUpdaterFiles,
} from '../scripts/release-lib.mjs';

const file = (path: string) => VERSION_FILES.find((entry) => entry.path === path)!;

test('nextPatchVersion increments only the patch number', () => {
  assert.equal(nextPatchVersion('0.2.12'), '0.2.13');
  assert.equal(nextPatchVersion('1.9.9'), '1.9.10');
  assert.throws(() => nextPatchVersion('0.2'));
});

test('bumpVersionText changes the package-lock root entries but not dependency versions', () => {
  const lock = '{\n  "version": "0.2.12",\n  "packages": {\n    "": {\n      "version": "0.2.12"\n    },\n    "node_modules/x": {\n      "version": "0.2.12"\n    }\n  }\n}';
  const bumped = bumpVersionText(lock, file('package-lock.json'), '0.2.12', '0.2.13');
  assert.equal(bumped.match(/0\.2\.13/g)?.length, 2);
  assert.equal(bumped.match(/0\.2\.12/g)?.length, 1);
});

test('bumpVersionText only touches the app entry in Cargo.lock', () => {
  const lock = '[[package]]\r\nname = "other"\r\nversion = "0.2.12"\r\n\r\n[[package]]\r\nname = "minh-spark-office"\r\nversion = "0.2.12"\r\n';
  const bumped = bumpVersionText(lock, file('src-tauri/Cargo.lock'), '0.2.12', '0.2.13');
  assert.ok(bumped.includes('name = "other"\r\nversion = "0.2.12"'));
  assert.ok(bumped.includes('name = "minh-spark-office"\r\nversion = "0.2.13"'));
});

test('bumpVersionText replaces every mention on the download page and fails when the version is absent', () => {
  const page = 'Bản 0.2.12 · MinhSparkOffice-0.2.12-windows.exe · 0.2.12';
  assert.equal(bumpVersionText(page, file('public/tai-ung-dung.html'), '0.2.12', '0.2.13'), 'Bản 0.2.13 · MinhSparkOffice-0.2.13-windows.exe · 0.2.13');
  assert.throws(() => bumpVersionText('nothing here', file('package.json'), '0.2.12', '0.2.13'));
});

test('parseChecksums accepts CRLF and binary markers', () => {
  const rows = parseChecksums('AB'.repeat(32) + '  a.exe\r\n' + 'cd'.repeat(32) + ' *b.dmg\r\n');
  assert.deepEqual(rows, [
    { hash: 'ab'.repeat(32), file: 'a.exe' },
    { hash: 'cd'.repeat(32), file: 'b.dmg' },
  ]);
});

test('releaseArtifactNames and missingPlatforms describe a complete release', () => {
  assert.equal(releaseArtifactNames('0.2.13').length, 4);
  const full = { platforms: { 'windows-x86_64-nsis': { signature: 's' }, 'windows-x86_64': { signature: 's' }, 'windows-x86_64-msi': { signature: 's' }, 'darwin-aarch64': { signature: 's' } } };
  assert.deepEqual(missingPlatforms(full), []);
  assert.deepEqual(missingPlatforms({ platforms: {} }).length, 4);
});

test('retainedUpdaterFiles keeps the updater files of the last releases before this one', () => {
  const files = ['0.2.9', '0.2.10', '0.2.15', '0.2.16', '0.2.17', '0.2.18'].flatMap((version) => [
    `MinhSparkOffice-${version}-windows-x64-vi-Setup.exe`,
    `MinhSparkOffice-${version}-windows-x64-en-US.msi`,
    `MinhSparkOffice-${version}-macos-arm64.app.tar.gz`,
    `MinhSparkOffice-${version}-macos-arm64.dmg`,
  ]).concat('SHA256SUMS.txt');
  const kept = retainedUpdaterFiles(files, '0.2.18');
  assert.deepEqual([...new Set(kept.map((name) => name.split('-')[1]))], ['0.2.15', '0.2.16', '0.2.17']);
  assert.equal(kept.length, 9);
  assert.ok(kept.every((name) => !name.endsWith('.dmg')));
  assert.deepEqual(retainedUpdaterFiles(files, '0.2.10'), retainedUpdaterFiles(files, '0.2.10', 3));
  assert.deepEqual([...new Set(retainedUpdaterFiles(files, '0.2.10').map((name) => name.split('-')[1]))], ['0.2.9']);
});
