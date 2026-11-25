import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const version = config.version;
const output = join(root, 'release');
const manifestFile = join(root, 'public/updates/latest.json');
const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
if (manifest.version !== version) throw new Error('Stage matching Windows release before merging macOS artifacts');
const key = process.env.MINHSPARK_UPDATER_KEY_PATH || join(process.env.LOCALAPPDATA || '', 'MinhSparkOffice/signing/updater.key');
const downloads = join(root, 'public/downloads');
await mkdir(downloads, { recursive: true });
const ARCHES = [['arm64', 'darwin-aarch64'], ['x64', 'darwin-x86_64']];
const staged = [];
for (const [arch, platform] of ARCHES) {
  const archiveName = `MinhSparkOffice-${version}-macos-${arch}.app.tar.gz`;
  const archive = join(output, archiveName);
  const signed = spawnSync(process.execPath, [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'signer', 'sign', '--private-key-path', key, '--app-version', version, archive], { cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '' } });
  if (signed.status !== 0) throw new Error(`macOS ${arch} updater signing failed`);
  const verified = spawnSync('cargo', ['run', '--quiet', '--manifest-path', join(root, 'src-tauri/Cargo.toml'), '--example', 'verify-updater', '--', archive, `${archive}.sig`, config.plugins.updater.pubkey, version], { cwd: root, windowsHide: true, stdio: 'inherit' });
  if (verified.status !== 0) throw new Error(`macOS ${arch} updater signature verification failed`);
  const signature = (await readFile(`${archive}.sig`, 'utf8')).trim();
  manifest.platforms[platform] = { signature, url: `https://office.minhspark.com/downloads/${archiveName}` };
  await copyFile(`${archive}.sig`, join(downloads, `${archiveName}.sig`));
  staged.push(`MinhSparkOffice-${version}-macos-${arch}.dmg`, archiveName);
}
const checksumsFile = join(downloads, 'SHA256SUMS.txt');
const checksums = (await readFile(checksumsFile, 'utf8')).split(/\r?\n/).filter((line) => line && !line.includes('-macos-'));
for (const name of staged) {
  await copyFile(join(output, name), join(downloads, name));
  const hash = createHash('sha256').update(await readFile(join(output, name))).digest('hex');
  checksums.push(`${hash}  ${name}`);
}
await writeFile(checksumsFile, `${checksums.join('\n')}\n`);
await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
await copyFile(manifestFile, join(output, 'updates/latest.json'));
await copyFile(checksumsFile, join(output, 'SHA256SUMS.txt'));
console.log(`macOS ${version} arm64 and x64 updater signatures verified and release staged`);
