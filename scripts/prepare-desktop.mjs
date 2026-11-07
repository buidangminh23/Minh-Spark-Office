import { realpath, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, isAbsolute } from 'node:path';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const distribution = await realpath(join(root, 'dist'));
const distributionRelative = relative(root, distribution);
if (distributionRelative.startsWith('..') || isAbsolute(distributionRelative) || distributionRelative !== 'dist') throw new Error('Desktop distribution must stay within the project dist directory');

for (const directory of ['downloads', 'updates']) {
  const candidate = join(distribution, directory);
  const resolved = await realpath(candidate).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!resolved) continue;
  const targetRelative = relative(distribution, resolved);
  if (targetRelative !== directory || isAbsolute(targetRelative)) throw new Error('Refusing to remove assets outside the generated distribution');
  await rm(resolved, { recursive: true, force: true });
}

console.log('Desktop assets prepared without downloadable installers');
