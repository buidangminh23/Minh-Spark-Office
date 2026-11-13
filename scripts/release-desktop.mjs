import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAC_INSTALL_COMMAND,
  PREFLIGHT_CHECKS,
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
const OPENSSH_DIR = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'OpenSSH');
const SSH = process.platform === 'win32' ? join(OPENSSH_DIR, 'ssh.exe') : 'ssh';
const SCP = process.platform === 'win32' ? join(OPENSSH_DIR, 'scp.exe') : 'scp';
const SSH_OPTIONS = ['-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4'];
const LINUX_DISTRO = process.env.MINHSPARK_LINUX_DISTRO || 'Ubuntu-26.04';
const STEPS = ['bump', 'windows', 'mac', 'linux', 'package', 'commit', 'deploy', 'verify', 'push'];
const LIVE_RETRIES = 6;
const LIVE_RETRY_MS = 10_000;

const options = parseArgs(process.argv.slice(2));
const temporaryPaths = [];

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

  heading(`Office 23 desktop release ${current} -> ${target}`);
  preflight({ checkClean: startIndex === 0 });
  if (options.dryRun) {
    console.log(`Dry run: would run ${STEPS.slice(startIndex).join(' -> ')}`);
    return;
  }

  if (runs('bump')) bump(current, target);
  if (runs('windows')) buildWindows();
  if (runs('mac')) buildMac(target);
  if (runs('linux')) buildLinux(target);
  if (runs('package')) {
    packageMac();
    ensureSigningKey();
    run(process.execPath, ['scripts/package-linux.mjs']);
  }
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
  const useShell = process.platform === 'win32' && (command === 'npx' || command === 'npm');
  const result = spawnSync(useShell ? `${command}.cmd` : command, args, {
    cwd,
    input,
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    shell: useShell,
    windowsHide: true,
  });
  if (result.status !== 0 && !allowFailure) throw new Error(`${command} ${args.join(' ')} exited with ${result.status ?? result.error?.message}`);
  return result.status === 0;
}

function capture(command, args, { cwd = root, input, timeout } = {}) {
  const result = spawnSync(command, args, { cwd, input, encoding: 'utf8', windowsHide: true, timeout });
  if (result.error?.code === 'ETIMEDOUT') throw new Error(`${command} ${args.join(' ')} timed out after ${timeout / 1000}s`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || '').trim()}`);
  return result.stdout.trim();
}

function remoteBash(script) {
  return `printf %s ${Buffer.from(script).toString('base64')} | base64 -d | bash -ls`;
}

function sshCapture(remoteCommand, { timeout }) {
  const dir = mkdtempSync(join(tmpdir(), 'mso-ssh-'));
  const outPath = join(dir, 'stdout.txt');
  const errPath = join(dir, 'stderr.txt');
  const out = openSync(outPath, 'w');
  const err = openSync(errPath, 'w');
  try {
    const result = spawnSync(SSH, [...SSH_OPTIONS, MAC_HOST, remoteCommand], { stdio: ['ignore', out, err], windowsHide: true, timeout });
    if (result.error?.code === 'ETIMEDOUT') throw new Error(`ssh ${MAC_HOST} timed out after ${timeout / 1000}s`);
    if (result.status !== 0) throw new Error(`ssh ${MAC_HOST} failed: ${readFileSync(errPath, 'utf8').trim()}`);
    return readFileSync(outPath, 'utf8').trim();
  } finally {
    closeSync(out);
    closeSync(err);
    rmSync(dir, { recursive: true, force: true });
  }
}

function readVersion() {
  return JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8')).version;
}

function preflight({ checkClean }) {
  heading('Preflight');
  if (process.platform !== 'win32') throw new Error('Run the release on the Windows build machine');
  if (checkClean && capture('git', ['status', '--porcelain']) !== '') throw new Error('Working tree is not clean; commit or stash first');
  requireOriginMain('HEAD does not contain origin/main; rebase onto origin/main first');
  for (const check of PREFLIGHT_CHECKS) {
    console.log(`\n--- ${check.label}: ${check.command} ${check.args.join(' ')}`);
    if (!run(check.command, check.args, { allowFailure: true })) throw new Error(`${check.label} failed; fix it before releasing`);
  }
  if (!existsSync(join(KEY_SOURCE, 'updater.key')) && !existsSync(join(KEY_LINK, 'updater.key'))) {
    throw new Error('Updater signing key not found; never generate a replacement key');
  }
  if (sshCapture('echo ok', { timeout: 60_000 }) !== 'ok') throw new Error(`Mac ${MAC_HOST} unreachable`);
  run('wsl.exe', ['-d', LINUX_DISTRO, '--', 'docker', 'info', '--format', '{{.ServerVersion}}']);
  run('npx', ['--yes', 'vercel@latest', 'whoami']);
  console.log('Preflight OK');
}

function requireOriginMain(message) {
  run('git', ['fetch', '--quiet', 'origin']);
  if (!run('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { allowFailure: true })) throw new Error(message);
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
  const key = [join(KEY_LINK, 'updater.key'), join(KEY_SOURCE, 'updater.key')].find((path) => existsSync(path));
  if (!key) throw new Error('Updater signing key not found; never generate a replacement key');
  process.env.MINHSPARK_UPDATER_KEY_PATH = key;
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
  run(SCP, ['-q', bundleName, `${MAC_HOST}:${MAC_BUILD_DIR}/${bundleName}`], { cwd: work });
  const script = [
    'set -euo pipefail',
    `cd "$HOME/${MAC_BUILD_DIR}"`,
    'rm -rf dist',
    `tar -xf src-${version}.tar`,
    `rm src-${version}.tar`,
    `if ! PATH=/usr/bin:$PATH bash scripts/build-macos.sh > build-${version}.log 2>&1; then tail -40 build-${version}.log; exit 1; fi`,
    `tail -3 build-${version}.log`,
  ].join('\n');
  run(SSH, [...SSH_OPTIONS, MAC_HOST, remoteBash(script)]);
  mkdirSync(join(root, 'release'), { recursive: true });
  const remote = `${MAC_HOST}:${MAC_BUILD_DIR}/release`;
  run(SCP, ['-q', `${remote}/MinhSparkOffice-${version}-macos-arm64.dmg`, `${remote}/MinhSparkOffice-${version}-macos-arm64.app.tar.gz`, `${remote}/SHA256SUMS-macos.txt`, '.'], { cwd: join(root, 'release') });
  for (const { hash, file } of parseChecksums(readFileSync(join(root, 'release/SHA256SUMS-macos.txt'), 'utf8'))) {
    if (sha256(readFileSync(join(root, 'release', file))) !== hash) throw new Error(`${file} changed in transfer`);
  }
  console.log('macOS artifacts copied and checksums match');
}

function buildLinux(version) {
  heading(`Build Linux ${version} on Ubuntu 22.04 in WSL`);
  if (!existsSync(join(root, 'dist/index.html')) || existsSync(join(root, 'dist/downloads'))) {
    throw new Error('dist is not the prepared desktop build; run --from windows first');
  }
  const work = mkdtempSync(join(tmpdir(), 'mso-linux-'));
  temporaryPaths.push(work);
  const bundle = join(work, 'source.tar');
  run('git', ['archive', '--format=tar', '-o', bundle, 'HEAD', 'src-tauri', 'scripts', 'package.json', 'package-lock.json']);
  run(WINDOWS_TAR, ['-rf', bundle, 'dist']);
  const linuxPath = (path) => capture('wsl.exe', ['-d', LINUX_DISTRO, '--', 'wslpath', '-a', '-u', path.replace(/\\/g, '/')]);
  const source = linuxPath(bundle);
  const output = linuxPath(join(root, 'release'));
  const script = [
    'set -euo pipefail',
    'build="$HOME/.cache/minh-spark-office/linux-build"',
    'mkdir -p "$build"',
    'cd "$build"',
    'test "$PWD" = "$HOME/.cache/minh-spark-office/linux-build"',
    'rm -rf dist',
    'tar -xf "$1"',
    'docker build -t minh-spark-office-linux:22.04 -f scripts/linux-build.Dockerfile scripts',
    'docker run --rm --init --memory=10g --cpus=4 -v "$build:/build" -v minh-spark-office-cargo:/root/.cargo/registry -v minh-spark-office-tauri-cache:/root/.cache minh-spark-office-linux:22.04',
    'cd release',
    'sha256sum -c SHA256SUMS-linux.txt',
    'cp "MinhSparkOffice-$3-linux-x64.deb" "MinhSparkOffice-$3-linux-x64.AppImage" SHA256SUMS-linux.txt "$2/"',
  ].join('\n');
  const quote = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
  const command = `set -- ${[source, output, version].map(quote).join(' ')}\n${script}`;
  run('wsl.exe', ['-d', LINUX_DISTRO, '--', 'bash', '-lc', remoteBash(command)]);
  for (const { hash, file } of parseChecksums(readFileSync(join(root, 'release/SHA256SUMS-linux.txt'), 'utf8'))) {
    if (sha256(readFileSync(join(root, 'release', file))) !== hash) throw new Error(`${file} changed in transfer`);
  }
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
  requireOriginMain(`origin/main gained commits that HEAD lacks; deploying now would roll production back. Rebase the release commits onto origin/main, then resume with --version ${version} --from deploy`);
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
  for (const extension of ['deb', 'AppImage']) {
    if (!page.includes(`MinhSparkOffice-${version}-linux-x64.${extension}`)) throw new Error(`Download page is missing Linux ${extension}`);
  }
  if (!page.includes(MAC_INSTALL_COMMAND)) throw new Error('Download page lost the macOS curl installer');
  const probe = [
    'set -euo pipefail',
    'dir=$(mktemp -d /tmp/mso-release.XXXXXX)',
    'trap \'rm -rf "$dir"\' EXIT',
    `curl -fsSL ${SITE}/install-macos.sh | PATH=/usr/bin:$PATH bash -s -- --dir "$dir" --no-launch > /dev/null 2>&1`,
    'app="$dir/Office 23.app"',
    'codesign --verify --deep --strict "$app"',
    'quarantined=$(find "$app" -exec xattr -p com.apple.quarantine {} \\; 2>/dev/null | wc -l | tr -d " ")',
    'echo "$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$app/Contents/Info.plist") $quarantined"',
  ].join('\n');
  const result = sshCapture(remoteBash(probe), { timeout: 600_000 }).split('\n').pop();
  if (result !== `${version} 0`) throw new Error(`Mac install check returned "${result}"`);
  console.log(`Mac curl install: ${version}, codesign OK, nothing quarantined`);
}

function push() {
  heading('Push release commits to main');
  requireOriginMain('origin/main moved after the deploy; rebase the release commits onto it, push by hand, then redeploy so production includes those commits');
  run('git', ['push', 'origin', 'HEAD:main']);
}

function cleanup() {
  for (const path of temporaryPaths) rmSync(path, { recursive: true, force: true });
}
