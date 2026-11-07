export const VERSION_FILES = [
  { path: 'package.json', pattern: (v) => new RegExp(`"version": "${escape(v)}"`), count: 1 },
  { path: 'package-lock.json', pattern: (v) => new RegExp(`"version": "${escape(v)}"`, 'g'), count: 2 },
  { path: 'src-tauri/tauri.conf.json', pattern: (v) => new RegExp(`"version": "${escape(v)}"`), count: 1 },
  { path: 'src-tauri/Cargo.toml', pattern: (v) => new RegExp(`^version = "${escape(v)}"`, 'm'), count: 1 },
  { path: 'src-tauri/Cargo.lock', pattern: (v) => new RegExp(`name = "minh-spark-office"\\r?\\nversion = "${escape(v)}"`), count: 1 },
  { path: 'public/tai-ung-dung.html', pattern: (v) => new RegExp(escape(v), 'g'), count: 'all' },
];

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const isSemver = (value) => /^\d+\.\d+\.\d+$/.test(value);

export const nextPatchVersion = (version) => {
  if (!isSemver(version)) throw new Error(`Not a plain x.y.z version: ${version}`);
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
};

export const bumpVersionText = (text, file, from, to) => {
  const pattern = file.pattern(from);
  const global = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  const matches = text.match(global) ?? [];
  if (matches.length === 0) throw new Error(`${file.path}: version ${from} not found`);
  if (file.count !== 'all' && matches.length < file.count) throw new Error(`${file.path}: expected ${file.count} occurrences of ${from}, found ${matches.length}`);
  let remaining = file.count === 'all' ? Infinity : file.count;
  return text.replace(global, (match) => {
    if (remaining <= 0) return match;
    remaining -= 1;
    return match.replace(from, to);
  });
};

export const parseChecksums = (text) =>
  text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^([a-f0-9]{64})\s+\*?(.+)$/i.exec(line);
      if (!match) throw new Error(`Bad checksum line: ${line}`);
      return { hash: match[1].toLowerCase(), file: match[2] };
    });

export const releaseArtifactNames = (version) => [
  `MinhSparkOffice-${version}-windows-x64-vi-Setup.exe`,
  `MinhSparkOffice-${version}-windows-x64-en-US.msi`,
  `MinhSparkOffice-${version}-macos-arm64.dmg`,
  `MinhSparkOffice-${version}-macos-arm64.app.tar.gz`,
];

export const EXPECTED_UPDATER_PLATFORMS = ['windows-x86_64-nsis', 'windows-x86_64', 'windows-x86_64-msi', 'darwin-aarch64'];

export const missingPlatforms = (manifest) => EXPECTED_UPDATER_PLATFORMS.filter((platform) => !manifest?.platforms?.[platform]?.signature);
