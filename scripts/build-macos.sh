#!/bin/bash
set -euo pipefail

root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$root"
export PATH="$HOME/bin:$HOME/.cargo/bin:/usr/bin:/bin:/opt/homebrew/bin:$PATH"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-1}"
export CARGO_INCREMENTAL=0
export CI=true

if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != arm64 ]; then
  printf '%s\n' 'This build requires an Apple Silicon Mac.' >&2
  exit 1
fi
if [ ! -f dist/index.html ] || [ -d dist/downloads ] || [ -d dist/updates ] || grep -q 'seo-fallback' dist/index.html; then
  printf '%s\n' 'Provide prepared frontend assets without release downloads in dist/.' >&2
  exit 1
fi

version="$(node -p 'JSON.parse(require("fs").readFileSync("src-tauri/tauri.conf.json", "utf8")).version')"
cli_version="$(node -p 'JSON.parse(require("fs").readFileSync("package-lock.json", "utf8")).packages["node_modules/@tauri-apps/cli"].version')"
tools_directory="$root/.macos-tools"
npm install --prefix "$tools_directory" --ignore-scripts --no-audit --no-fund "@tauri-apps/cli@$cli_version"

iconset="$tools_directory/Office.iconset"
mkdir -p "$iconset"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" src-tauri/icons/128x128@2x.png --out "$iconset/icon_${size}x${size}.png" >/dev/null
  retina_size=$((size * 2))
  sips -z "$retina_size" "$retina_size" src-tauri/icons/128x128@2x.png --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil --convert icns "$iconset" --output src-tauri/icons/icon.icns

"$tools_directory/node_modules/.bin/tauri" build --target aarch64-apple-darwin --config src-tauri/tauri.macos.conf.json --bundles app

app="$root/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Minh Spark Office.app"
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist")" = "$version"
test "$(lipo -archs "$app/Contents/MacOS/minh-spark-office")" = arm64
codesign --verify --deep --strict --verbose=2 "$app"
codesign --display --verbose=2 "$app" 2>&1
file "$app/Contents/MacOS/minh-spark-office"
output="$root/release"
mkdir -p "$output"
updater="MinhSparkOffice-$version-macos-arm64.app.tar.gz"
dmg="MinhSparkOffice-$version-macos-arm64.dmg"
COPYFILE_DISABLE=1 tar -czf "$output/$updater" -C "$(dirname "$app")" 'Minh Spark Office.app'
stage="$(mktemp -d "$tools_directory/dmg-stage.XXXXXX")"
ditto "$app" "$stage/Minh Spark Office.app"
ln -s /Applications "$stage/Applications"
hdiutil create -volname 'Minh Spark Office' -srcfolder "$stage" -ov -format UDZO "$output/$dmg"
hdiutil verify "$output/$dmg"
(cd "$output" && shasum -a 256 "$dmg" "$updater" > SHA256SUMS-macos.txt)
printf '%s\n' 'Apple Silicon artifacts built with ad-hoc code signing; no Apple notarization. Publish the curl installer (public/install-macos.sh) as the primary macOS install path; browser-downloaded DMGs are quarantined and blocked by Gatekeeper.'
cat "$output/SHA256SUMS-macos.txt"
