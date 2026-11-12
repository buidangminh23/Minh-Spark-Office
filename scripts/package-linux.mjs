import { createHash } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const version = config.version;
const manifestFile = join(root, 'public/updates/latest.json');
const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
if (manifest.version !== version) throw new Error('Stage matching Windows release before Linux');
const key = process.env.MINHSPARK_UPDATER_KEY_PATH || join(process.env.LOCALAPPDATA || '', 'MinhSparkOffice/signing/updater.key');
const downloads = join(root, 'public/downloads');
const checksumsFile = join(downloads, 'SHA256SUMS.txt');
const checksums = (await readFile(checksumsFile, 'utf8')).split(/\r?\n/).filter((line) => line && !line.includes('-linux-'));
for (const [extension, target] of [['deb', 'linux-x86_64-deb'], ['AppImage', 'linux-x86_64-appimage']]) {
  const name = `MinhSparkOffice-${version}-linux-x64.${extension}`;
  const source = join(root, 'release', name);
  const signed = spawnSync(process.execPath, [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'signer', 'sign', '--private-key-path', key, '--app-version', version, source], { cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '' } });
  if (signed.status !== 0) throw new Error(`Linux ${extension} signing failed`);
  const verified = spawnSync('cargo', ['run', '--quiet', '--manifest-path', join(root, 'src-tauri/Cargo.toml'), '--example', 'verify-updater', '--', source, `${source}.sig`, config.plugins.updater.pubkey, version], { cwd: root, windowsHide: true, stdio: 'inherit' });
  if (verified.status !== 0) throw new Error(`Linux ${extension} signature verification failed`);
  const signature = (await readFile(`${source}.sig`, 'utf8')).trim();
  const entry = { signature, url: `https://office.minhspark.com/downloads/${name}` };
  manifest.platforms[target] = entry;
  if (extension === 'AppImage') manifest.platforms['linux-x86_64'] = entry;
  await copyFile(source, join(downloads, name));
  await copyFile(`${source}.sig`, join(downloads, `${name}.sig`));
  checksums.push(`${createHash('sha256').update(await readFile(source)).digest('hex')}  ${name}`);
}
await writeFile(checksumsFile, `${checksums.join('\n')}\n`);
await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
await copyFile(manifestFile, join(root, 'release/updates/latest.json'));
await copyFile(checksumsFile, join(root, 'release/SHA256SUMS.txt'));
console.log(`Linux ${version} signatures verified and release staged`);
