import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERSION_FILES,
  bumpVersionText,
  isSemver,
  missingPlatforms,
  nextPatchVersion,
  parseChecksums,
  releaseArtifactNames,
  retainedUpdaterFiles,
} from './release-lib.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const SITE = process.env.MINHSPARK_SITE || 'https://office.minhspark.com';
const VERCEL_SCOPE = process.env.MINHSPARK_VERCEL_SCOPE || 'buidangminh23s-projects';
const MAC_HOST = process.env.MINHSPARK_MAC_HOST || 'mac';
const MAC_BUILD_DIR = process.env.MINHSPARK_MAC_BUILD_DIR || 'Library/Caches/minh-spark-office/build-0.2.1';
const LOCAL_APP_DATA = process.env.LOCALAPPDATA || '';
const KEY_LINK = join(LOCAL_APP_DATA, 'MinhSparkOffice', 'signing');
const KEY_SOURCE = process.env.MINHSPARK_UPDATER_KEY_DIR
  || join(LOCAL_APP_DATA, 'Packages', 'OpenAI.Codex_2p2nqsd0c76g0', 'LocalCache', 'Local', 'MinhSparkOffice', 'signing');
const WINDOWS_TAR = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const STEPS = ['bump', 'windows', 'mac', 'package', 'commit', 'deploy', 'verify', 'push'];
const LIVE_RETRIES = 6;
const LIVE_RETRY_MS = 10_000;

const options = parseArgs(process.argv.slice(2));
const temporaryPaths = [];
let createdKeyLink = false;

try {
  await main();
} catch (error) {
  console.error(`\nRELEASE FAILED: ${error.message}`);
  console.error(`Fix the cause, then resume with: node scripts/release-desktop.mjs --version ${options.version ?? '<x.y.z>'} --from <step>`);
  process.exitCode = 1;
} finally {
  cleanup();
}

async function main() {
  const current = readVersion();
  const target = options.version ?? (options.from ? current : nextPatchVersion(current));
  if (!isSemver(target)) throw new Error(`Invalid version ${target}`);
  options.version = target;
  const startIndex = options.from ? STEPS.indexOf(options.from) : 0;
  if (startIndex < 0) throw new Error(`--from must be one of: ${STEPS.join(', ')}`);
  const runs = (step) => STEPS.indexOf(step) >= startIndex;

  heading(`Minh Spark Office desktop release ${current} -> ${target}`);
  preflight({ checkClean: startIndex === 0 });
  if (options.dryRun) {
    console.log(`Dry run: would run ${STEPS.slice(startIndex).join(' -> ')}`);
    return;
  }

  if (runs('bump')) bump(current, target);
  if (runs('windows')) buildWindows();
  if (runs('mac')) buildMac(target);
  if (runs('package')) packageMac();
  if (runs('commit')) commitRelease(target);
  if (runs('deploy')) deploy(target);
  if (runs('verify')) await verify(target);
  if (runs('push')) push();
  heading(`Released ${target}: web and installers are live and verified`);
}

function parseArgs(argv) {
  const parsed = { version: null, from: null, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--version') parsed.version = argv[++index];
    else if (arg === '--from') parsed.from = argv[++index];
    else if (arg === '--dry-run') parsed.dryRun = true;
    else throw new Error(`Unknown argument ${arg}. Use --version x.y.z, --from <step>, --dry-run`);
  }
  return parsed;
}

function heading(text) {
  console.log(`\n=== ${text} ===`);
}

function run(command, args, { cwd = root, input, allowFailure = false } = {}) {
  const useShell = process.platform === 'win32' && command === 'npx';
  const result = spawnSync(useShell ? 'npx.cmd' : command, args, {
    cwd,
    input,
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    shell: useShell,
    windowsHide: true,
  });
  if (result.status !== 0 && !allowFailure) throw new Error(`${command} ${args.join(' ')} exited with ${result.status ?? result.error?.message}`);
  return result.status === 0;
}

function capture(command, args, { cwd = root, input } = {}) {
  const result = spawnSync(command, args, { cwd, input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || '').trim()}`);
  return result.stdout.trim();
}

function readVersion() {
  return JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8')).version;
}

function preflight({ checkClean }) {
  heading('Preflight');
  if (process.platform !== 'win32') throw new Error('Run the release on the Windows build machine');
  if (checkClean && capture('git', ['status', '--porcelain']) !== '') throw new Error('Working tree is not clean; commit or stash first');
  run('git', ['fetch', '--quiet', 'origin']);
  if (!run('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { allowFailure: true })) {
    throw new Error('HEAD does not contain origin/main; rebase onto origin/main first');
  }
  if (!existsSync(join(KEY_SOURCE, 'updater.key')) && !existsSync(join(KEY_LINK, 'updater.key'))) {
    throw new Error('Updater signing key not found; never generate a replacement key');
  }
  if (capture('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', MAC_HOST, 'echo ok']) !== 'ok') throw new Error(`Mac ${MAC_HOST} unreachable`);
  run('npx', ['--yes', 'vercel@latest', 'whoami']);
  console.log('Preflight OK');
}

function bump(from, to) {
  heading(`Bump ${from} -> ${to}`);
  if (from === to) {
    console.log('Version already set; skipping bump');
    return;
  }
  for (const file of VERSION_FILES) {
    const path = join(root, file.path);
    writeFileSync(path, bumpVersionText(readFileSync(path, 'utf8'), file, from, to));
  }
  run('git', ['add', ...VERSION_FILES.map((file) => file.path)]);
  run('git', ['commit', '-q', '-m', `chore(release): bump desktop to ${to}`]);
}

function ensureSigningKey() {
  if (existsSync(join(KEY_LINK, 'updater.key'))) return;
  mkdirSync(dirname(KEY_LINK), { recursive: true });
  run('pwsh', ['-NoProfile', '-Command', `New-Item -ItemType Junction -Path '${KEY_LINK}' -Target '${KEY_SOURCE}' | Out-Null`]);
  createdKeyLink = true;
}

function buildWindows() {
  heading('Build and sign Windows installers');
  ensureSigningKey();
  run('pwsh', ['-NoProfile', '-File', 'scripts/build-desktop.ps1', '-StageWeb']);
}

function buildMac(version) {
  heading(`Build macOS ${version} on ${MAC_HOST}`);
  if (!existsSync(join(root, 'dist/index.html')) || existsSync(join(root, 'dist/downloads'))) {
    throw new Error('dist is not the prepared desktop build; run --from windows first');
  }
  const work = mkdtempSync(join(tmpdir(), 'mso-mac-'));
  temporaryPaths.push(work);
  const bundleName = `src-${version}.tar`;
  const bundle = join(work, bundleName);
  run('git', ['archive', '--format=tar', '-o', bundle, 'HEAD', 'src-tauri', 'scripts', 'package.json', 'package-lock.json']);
  run(WINDOWS_TAR, ['-rf', bundle, 'dist']);
  run('scp', ['-q', bundleName, `${MAC_HOST}:${MAC_BUILD_DIR}/${bundleName}`], { cwd: work });
  const script = [
    'set -euo pipefail',
    `cd "$HOME/${MAC_BUILD_DIR}"`,
    'rm -rf dist',
    `tar -xf src-${version}.tar`,
    `rm src-${version}.tar`,
    `if ! PATH=/usr/bin:$PATH bash scripts/build-macos.sh > build-${version}.log 2>&1; then tail -40 build-${version}.log; exit 1; fi`,
    `tail -3 build-${version}.log`,
  ].join('\n');
  run('ssh', [MAC_HOST, 'bash -ls'], { input: script });
  mkdirSync(join(root, 'release'), { recursive: true });
  const remote = `${MAC_HOST}:${MAC_BUILD_DIR}/release`;
  run('scp', ['-q', `${remote}/MinhSparkOffice-${version}-macos-arm64.dmg`, `${remote}/MinhSparkOffice-${version}-macos-arm64.app.tar.gz`, `${remote}/SHA256SUMS-macos.txt`, '.'], { cwd: join(root, 'release') });
  for (const { hash, file } of parseChecksums(readFileSync(join(root, 'release/SHA256SUMS-macos.txt'), 'utf8'))) {
    if (sha256(readFileSync(join(root, 'release', file))) !== hash) throw new Error(`${file} changed in transfer`);
  }
  console.log('macOS artifacts copied and checksums match');
}

function packageMac() {
  heading('Sign macOS updater and merge the manifest');
  ensureSigningKey();
  run(process.execPath, ['scripts/package-macos.mjs']);
}

function commitRelease(version) {
  heading('Commit release manifests');
  run('git', ['add', 'public/downloads/SHA256SUMS.txt', 'public/updates/latest.json']);
  if (capture('git', ['diff', '--cached', '--name-only']) === '') {
    console.log('Nothing new to commit');
    return;
  }
  run('git', ['commit', '-q', '-m', `release: ship desktop ${version}`]);
}

function projectLinkFile() {
  const commonDir = resolve(root, capture('git', ['rev-parse', '--git-common-dir']));
  return [join(root, '.vercel/project.json'), join(dirname(commonDir), '.vercel/project.json')].find((path) => existsSync(path));
}

function deploy(version) {
  heading('Deploy web with installers');
  const link = projectLinkFile();
  if (!link) throw new Error('No .vercel/project.json found; run vercel link once in the main checkout');
  const site = mkdtempSync(join(tmpdir(), 'mso-site-'));
  temporaryPaths.push(site);
  const archive = join(site, '..', `${site.split(/[\\/]/).pop()}.tar`);
  temporaryPaths.push(archive);
  run('git', ['archive', '--format=tar', '-o', archive, 'HEAD']);
  run(WINDOWS_TAR, ['-xf', archive, '-C', site]);
  for (const name of releaseArtifactNames(version)) {
    const source = join(root, 'public/downloads', name);
    if (!existsSync(source)) throw new Error(`Missing installer ${name}`);
    copyFileSync(source, join(site, 'public/downloads', name));
  }
  const retained = retainedUpdaterFiles(readdirSync(join(root, 'public/downloads')), version);
  const kept = retained.filter((name) => {
    try {
      copyFileSync(join(root, 'public/downloads', name), join(site, 'public/downloads', name));
      return true;
    } catch (error) {
      console.warn(`Skipping unreadable earlier installer ${name} (${error.code ?? error.message}); apps that miss it re-check and fetch ${version}`);
      return false;
    }
  });
  console.log(`Keeping ${kept.length} installers of earlier versions for apps that found them before this release`);
  for (const { hash, file } of parseChecksums(readFileSync(join(site, 'public/downloads/SHA256SUMS.txt'), 'utf8'))) {
    if (sha256(readFileSync(join(site, 'public/downloads', file))) !== hash) throw new Error(`${file} does not match SHA256SUMS.txt`);
  }
  mkdirSync(join(site, '.vercel'), { recursive: true });
  copyFileSync(link, join(site, '.vercel/project.json'));
  run('npx', ['--yes', 'vercel@latest', 'deploy', '--prod', '--yes', '--scope', VERCEL_SCOPE], { cwd: site });
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function fetchLive(path) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${SITE}${path}${path.includes('?') ? '&' : '?'}release=${Date.now()}`);
    if (response.ok) return response;
    const transient = response.status === 404 || response.status >= 500;
    if (!transient || attempt >= LIVE_RETRIES) throw new Error(`${path} returned ${response.status}`);
    console.log(`${path} returned ${response.status} while the CDN updates; retry ${attempt}/${LIVE_RETRIES}`);
    await new Promise((done) => setTimeout(done, LIVE_RETRY_MS));
  }
}

async function waitForManifest(version) {
  for (let attempt = 1; attempt <= LIVE_RETRIES; attempt += 1) {
    const manifest = await (await fetchLive('/updates/latest.json')).json();
    if (manifest.version === version) return manifest;
    console.log(`latest.json still ${manifest.version}; retry ${attempt}/${LIVE_RETRIES}`);
    await new Promise((done) => setTimeout(done, LIVE_RETRY_MS));
  }
  throw new Error(`latest.json never reached ${version}`);
}

async function verify(version) {
  heading('Verify the live site');
  const manifest = await waitForManifest(version);
  const missing = missingPlatforms(manifest);
  if (missing.length) throw new Error(`latest.json lacks ${missing.join(', ')}`);
  console.log(`latest.json ${version} with all updater platforms`);
  const sums = parseChecksums(await (await fetchLive('/downloads/SHA256SUMS.txt')).text());
  for (const name of releaseArtifactNames(version)) {
    const entry = sums.find((row) => row.file === name);
    if (!entry) throw new Error(`SHA256SUMS.txt lacks ${name}`);
    const live = sha256(Buffer.from(await (await fetchLive(`/downloads/${name}`)).arrayBuffer()));
    if (live !== entry.hash) throw new Error(`${name} on the site does not match its checksum`);
    console.log(`OK ${name}`);
  }
  const page = await (await fetchLive('/tai-ung-dung.html')).text();
  if (!page.includes(`MinhSparkOffice-${version}-windows-x64-vi-Setup.exe`)) throw new Error('Download page does not link this version');
  const probe = [
    'set -euo pipefail',
    'dir=$(mktemp -d /tmp/mso-release.XXXXXX)',
    'trap \'rm -rf "$dir"\' EXIT',
    `curl -fsSL ${SITE}/install-macos.sh | PATH=/usr/bin:$PATH bash -s -- --dir "$dir" --no-launch > /dev/null 2>&1`,
    'app="$dir/Minh Spark Office.app"',
    'codesign --verify --deep --strict "$app"',
    'quarantined=$(find "$app" -exec xattr -p com.apple.quarantine {} \\; 2>/dev/null | wc -l | tr -d " ")',
    'echo "$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$app/Contents/Info.plist") $quarantined"',
  ].join('\n');
  const result = capture('ssh', [MAC_HOST, 'bash -ls'], { input: probe }).split('\n').pop();
  if (result !== `${version} 0`) throw new Error(`Mac install check returned "${result}"`);
  console.log(`Mac curl install: ${version}, codesign OK, nothing quarantined`);
}

function push() {
  heading('Push release commits to main');
  run('git', ['fetch', '--quiet', 'origin']);
  if (!run('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { allowFailure: true })) {
    throw new Error('origin/main moved during the release; rebase the release commits onto it and push by hand (the site is already live)');
  }
  run('git', ['push', 'origin', 'HEAD:main']);
}

function cleanup() {
  for (const path of temporaryPaths) rmSync(path, { recursive: true, force: true });
  if (createdKeyLink) {
    spawnSync('cmd', ['/c', 'rmdir', KEY_LINK], { windowsHide: true });
    spawnSync('cmd', ['/c', 'rmdir', dirname(KEY_LINK)], { windowsHide: true });
  }
}
