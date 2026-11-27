import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUCKET = process.env.MINHSPARK_R2_BUCKET || 'minh-spark-office-files';
export const ASSET_LIMIT = 25 * 1024 * 1024;
const WRANGLER = ['--yes', 'wrangler@4.168.0'];
const LARGE_ASSET_PREFIXES = ['layout-engine/', 'ocr/'];
const CONTENT_TYPES = [
  ['.gz', 'application/gzip'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
];

export const contentTypeFor = (name) => CONTENT_TYPES.find(([extension]) => name.endsWith(extension) && !name.endsWith('.tar.gz'))?.[1] ?? 'application/octet-stream';

function walk(directory, base = directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path, base) : [relative(base, path).split(sep).join('/')];
  });
}

function wrangler(args, cwd) {
  const npx = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const [command, prefix] = existsSync(npx) ? [process.execPath, [npx]] : ['npx', []];
  const result = spawnSync(command, [...prefix, ...WRANGLER, ...args], { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`wrangler ${args.slice(0, 3).join(' ')} failed`);
}

export function uploadObject(root, key, file) {
  console.log(`R2 ${key} (${(statSync(file).size / 1048576).toFixed(1)} MB)`);
  wrangler(['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--content-type', contentTypeFor(key), '--remote'], root);
}

export function deleteObject(root, key) {
  wrangler(['r2', 'object', 'delete', `${BUCKET}/${key}`, '--remote'], root);
}

export function largeAssets(dist) {
  return walk(dist).filter((path) => statSync(join(dist, path)).size > ASSET_LIMIT);
}

export function deployCloudflare(root, { installers = [], uploadLarge = true } = {}) {
  const dist = join(root, 'dist');
  if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/index.html missing; run npm run build first');
  const large = largeAssets(dist);
  const unexpected = large.filter((path) => !LARGE_ASSET_PREFIXES.some((prefix) => path.startsWith(prefix)));
  if (unexpected.length) throw new Error(`Files over 25 MiB outside ${LARGE_ASSET_PREFIXES.join(', ')}: ${unexpected.join(', ')}`);
  writeFileSync(join(dist, '.assetsignore'), large.map((path) => `/${path}`).join('\n') + '\n');
  if (uploadLarge) for (const path of large) uploadObject(root, path, join(dist, path));
  for (const file of installers) uploadObject(root, `downloads/${file.split(/[\\/]/).pop()}`, file);
  wrangler(['deploy'], root);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const installers = args.filter((arg) => !arg.startsWith('--')).map((arg) => resolve(arg));
  deployCloudflare(root, { installers, uploadLarge: !args.includes('--skip-large') });
}
