import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const output = join(root, 'release');
await mkdir(output, { recursive: true });
const checksums = [];

for (const [bundle, extension, suffix] of [['nsis', '.exe', 'vi-Setup'], ['msi', '.msi', 'en-US']]) {
  const directory = join(root, 'src-tauri/target/release/bundle', bundle);
  const matches = (await readdir(directory)).filter((name) => name.endsWith(extension) && name.includes(`_${config.version}_`));
  if (matches.length !== 1) throw new Error(`Expected one ${bundle} installer for ${config.version}, found ${matches.length}`);
  const name = `MinhSparkOffice-${config.version}-windows-x64-${suffix}${extension}`;
  const source = join(directory, matches[0]);
  const content = await readFile(source);
  await copyFile(source, join(output, name));
  checksums.push(`${createHash('sha256').update(content).digest('hex')}  ${name}`);
  console.log(`${name}: ${(content.length / 1024 / 1024).toFixed(1)} MB`);
}

await writeFile(join(output, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`);
