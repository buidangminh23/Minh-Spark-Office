import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const output = join(root, 'release');
const stageWeb = process.argv.includes('--stage-web');
if (process.argv.slice(2).some((argument) => argument !== '--stage-web')) throw new Error('Only --stage-web is supported');
if (!config.plugins?.updater?.pubkey) throw new Error('The updater public key is missing');
await mkdir(output, { recursive: true });
const checksums = [];
const artifacts = [];
const updaterDirectory = join(output, 'updates');
const downloadsDirectory = join(root, 'public/downloads');
const manifest = {
  version: config.version,
  notes: process.env.MINHSPARK_RELEASE_NOTES || 'Đồng bộ tài liệu giữa web và Windows; đăng nhập Google; kiểm tra và cài đặt bản cập nhật.',
  pub_date: new Date().toISOString(),
  platforms: {},
};

for (const [bundle, extension, suffix] of [['nsis', '.exe', 'vi-Setup'], ['msi', '.msi', 'en-US']]) {
  const directory = join(root, 'src-tauri/target/release/bundle', bundle);
  const matches = (await readdir(directory)).filter((name) => name.endsWith(extension) && name.includes(`_${config.version}_`));
  if (matches.length !== 1) throw new Error(`Expected one ${bundle} installer for ${config.version}, found ${matches.length}`);
  const name = `MinhSparkOffice-${config.version}-windows-x64-${suffix}${extension}`;
  const source = join(directory, matches[0]);
  const signaturePath = `${source}.sig`;
  const signature = (await readFile(signaturePath, 'utf8')).trim();
  const verified = spawnSync('cargo', ['run', '--quiet', '--manifest-path', join(root, 'src-tauri/Cargo.toml'), '--example', 'verify-updater', '--', source, signaturePath, config.plugins.updater.pubkey, config.version], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (verified.status !== 0) throw new Error(`Invalid updater signature for ${bundle}`);
  const content = await readFile(source);
  await copyFile(source, join(output, name));
  await copyFile(signaturePath, join(output, `${name}.sig`));
  checksums.push(`${createHash('sha256').update(content).digest('hex')}  ${name}`);
  artifacts.push(name, `${name}.sig`);
  const update = { signature, url: `https://office.minhspark.com/downloads/${name}` };
  manifest.platforms[`windows-x86_64-${bundle}`] = update;
  if (bundle === 'nsis') manifest.platforms['windows-x86_64'] = update;
  console.log(`${name}: ${(content.length / 1024 / 1024).toFixed(1)} MB`);
}

await writeFile(join(output, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`);
await mkdir(updaterDirectory, { recursive: true });
await writeFile(join(updaterDirectory, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

if (stageWeb) {
  await mkdir(downloadsDirectory, { recursive: true });
  await mkdir(join(root, 'public/updates'), { recursive: true });
  for (const name of [...artifacts, 'SHA256SUMS.txt']) await copyFile(join(output, name), join(downloadsDirectory, name));
  await copyFile(join(updaterDirectory, 'latest.json'), join(root, 'public/updates/latest.json'));
  console.log('Verified installers and updater manifest staged in public/');
}
