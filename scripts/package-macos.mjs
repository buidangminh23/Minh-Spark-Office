import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const version = config.version;
const output = join(root, 'release');
const archiveName = `MinhSparkOffice-${version}-macos-arm64.app.tar.gz`;
const imageName = `MinhSparkOffice-${version}-macos-arm64.dmg`;
const archive = join(output, archiveName);
const manifestFile = join(root, 'public/updates/latest.json');
const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
if (manifest.version !== version) throw new Error('Stage matching Windows release before merging macOS artifacts');
const key = process.env.MINHSPARK_UPDATER_KEY_PATH || join(process.env.LOCALAPPDATA || '', 'MinhSparkOffice/signing/updater.key');
const signed = spawnSync(process.execPath, [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'signer', 'sign', '--private-key-path', key, '--app-version', version, archive], { cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '' } });
if (signed.status !== 0) throw new Error('macOS updater signing failed');
const verified = spawnSync('cargo', ['run', '--quiet', '--manifest-path', join(root, 'src-tauri/Cargo.toml'), '--example', 'verify-updater', '--', archive, `${archive}.sig`, config.plugins.updater.pubkey, version], { cwd: root, windowsHide: true, stdio: 'inherit' });
if (verified.status !== 0) throw new Error('macOS updater signature verification failed');
const downloads = join(root, 'public/downloads');
await mkdir(downloads, { recursive: true });
const signature = (await readFile(`${archive}.sig`, 'utf8')).trim();
manifest.platforms['darwin-aarch64'] = { signature, url: `https://office.minhspark.com/downloads/${archiveName}` };
const checksumsFile = join(downloads, 'SHA256SUMS.txt');
const checksums = (await readFile(checksumsFile, 'utf8')).split(/\r?\n/).filter((line) => line && !line.includes('-macos-'));
for (const name of [imageName, archiveName]) {
  await copyFile(join(output, name), join(downloads, name));
  const hash = createHash('sha256').update(await readFile(join(output, name))).digest('hex');
  checksums.push(`${hash}  ${name}`);
}
await copyFile(`${archive}.sig`, join(downloads, `${archiveName}.sig`));
await writeFile(checksumsFile, `${checksums.join('\n')}\n`);
await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
await copyFile(manifestFile, join(output, 'updates/latest.json'));
await copyFile(checksumsFile, join(output, 'SHA256SUMS.txt'));
console.log(`macOS ${version} updater signature verified and release staged`);
