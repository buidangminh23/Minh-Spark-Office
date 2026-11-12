#!/bin/bash
set -euo pipefail
root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$root"
if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
  printf '%s\n' 'This build requires Linux x86_64.' >&2
  exit 1
fi
if [ ! -f dist/index.html ] || [ -d dist/downloads ] || [ -d dist/updates ] || grep -q 'seo-fallback' dist/index.html; then
  printf '%s\n' 'Provide prepared frontend assets in dist/.' >&2
  exit 1
fi
version="$(node -p 'JSON.parse(require("fs").readFileSync("src-tauri/tauri.conf.json", "utf8")).version')"
cli_version="$(node -p 'JSON.parse(require("fs").readFileSync("package-lock.json", "utf8")).packages["node_modules/@tauri-apps/cli"].version')"
npm install --prefix .linux-tools --ignore-scripts --no-audit --no-fund "@tauri-apps/cli@$cli_version"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-4}"
export CARGO_INCREMENTAL=0 CI=true APPIMAGE_EXTRACT_AND_RUN=1
cargo clean --manifest-path src-tauri/Cargo.toml --release --package minh-spark-office
.linux-tools/node_modules/.bin/tauri build --config src-tauri/tauri.linux.conf.json --bundles deb,appimage -- --locked
mkdir -p release
deb="src-tauri/target/release/bundle/deb/Minh Spark Office_${version}_amd64.deb"
appimage="src-tauri/target/release/bundle/appimage/Minh Spark Office_${version}_amd64.AppImage"
test "$(dpkg-deb -f "$deb" Version)" = "$version"
test "$(dpkg-deb -f "$deb" Architecture)" = amd64
cp "$deb" "release/MinhSparkOffice-$version-linux-x64.deb"
cp "$appimage" "release/MinhSparkOffice-$version-linux-x64.AppImage"
cd release
sha256sum "MinhSparkOffice-$version-linux-x64.deb" "MinhSparkOffice-$version-linux-x64.AppImage" > SHA256SUMS-linux.txt
cat SHA256SUMS-linux.txt
