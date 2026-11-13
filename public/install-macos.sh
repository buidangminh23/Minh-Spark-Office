#!/bin/bash
set -euo pipefail

BASE_URL="${MINHSPARK_OFFICE_BASE_URL:-https://office.minhspark.com}"
APP_NAME="Office 23.app"
LEGACY_APP_NAME="Minh Spark Office.app"
BUNDLE_ID="com.minhspark.office"
EXECUTABLE="minh-spark-office"
MINIMUM_MACOS="13.3"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

work=""

say() { printf '%s\n' "$*"; }
die() { printf 'Office 23: %s\n' "$*" >&2; exit 1; }

version_at_least() {
  local IFS=.
  local -a have=($1) need=($2)
  local index
  for index in 0 1 2; do
    local left="${have[$index]:-0}" right="${need[$index]:-0}"
    if [ "$left" -gt "$right" ]; then return 0; fi
    if [ "$left" -lt "$right" ]; then return 1; fi
  done
  return 0
}

installed_app() {
  local folder
  for folder in "$1" /Applications "$HOME/Applications"; do
    if [ -n "$folder" ] && [ -d "$folder/$APP_NAME" ]; then
      printf '%s\n' "$folder/$APP_NAME"
      return 0
    fi
  done
  return 1
}

running_from() {
  local pid
  for pid in $(pgrep -x "$EXECUTABLE" 2>/dev/null); do
    case "$(ps -o comm= -p "$pid" 2>/dev/null)" in
      "$1"/*) return 0 ;;
    esac
  done
  return 1
}

strip_quarantine() {
  find "$1" -exec xattr -d com.apple.quarantine {} \; 2>/dev/null || true
}

quarantined_items() {
  local count=0 item
  while IFS= read -r -d '' item; do
    if xattr -p com.apple.quarantine "$item" >/dev/null 2>&1; then count=$((count + 1)); fi
  done < <(find "$1" -print0)
  printf '%s\n' "$count"
}

main() {
  local target_dir="" launch=1
  while [ $# -gt 0 ]; do
    case "$1" in
      --dir) target_dir="${2:-}"; shift 2 ;;
      --no-launch) launch=0; shift ;;
      -h|--help) say "Cách dùng: install-macos.sh [--dir THƯ_MỤC] [--no-launch]"; exit 0 ;;
      *) die "không hiểu tuỳ chọn $1" ;;
    esac
  done

  [ "$(uname -s)" = Darwin ] || die "trình cài này chỉ dành cho macOS"
  [ "$(uname -m)" = arm64 ] || die "bản macOS chỉ chạy trên máy Mac chip Apple Silicon; máy Intel hãy dùng bản web tại $BASE_URL"
  version_at_least "$(sw_vers -productVersion)" "$MINIMUM_MACOS" || die "cần macOS $MINIMUM_MACOS trở lên"

  if [ -z "$target_dir" ]; then
    local existing
    if existing="$(installed_app "")"; then
      target_dir="$(dirname "$existing")"
    elif [ -w /Applications ]; then
      target_dir="/Applications"
    else
      target_dir="$HOME/Applications"
    fi
  fi
  mkdir -p "$target_dir" 2>/dev/null || die "không tạo được thư mục $target_dir"
  [ -w "$target_dir" ] || die "không ghi được vào $target_dir; chạy lại với --dir \"$HOME/Applications\""
  target_dir="$(cd "$target_dir" && pwd -P)" || die "không mở được thư mục $target_dir"
  local destination="$target_dir/$APP_NAME"
  local legacy="$target_dir/$LEGACY_APP_NAME"
  if running_from "$destination" || running_from "$legacy"; then
    die "Office 23 đang mở. Hãy lưu tài liệu, thoát ứng dụng (Cmd+Q) rồi chạy lại lệnh cài"
  fi

  work="$(mktemp -d "${TMPDIR:-/tmp}/minh-spark-office.XXXXXX")"
  trap 'rm -rf "$work"' EXIT

  curl -fsSL "$BASE_URL/downloads/SHA256SUMS.txt" -o "$work/SHA256SUMS.raw" || die "không đọc được danh sách phiên bản từ $BASE_URL"
  tr -d '\r' < "$work/SHA256SUMS.raw" > "$work/SHA256SUMS.txt"
  local archive expected
  archive="$(awk '$2 ~ /^MinhSparkOffice-[0-9.]+-macos-arm64\.app\.tar\.gz$/ { print $2; exit }' "$work/SHA256SUMS.txt")"
  [ -n "$archive" ] || die "chưa có bản macOS trên máy chủ"
  expected="$(awk -v name="$archive" '$2 == name { print $1; exit }' "$work/SHA256SUMS.txt")"
  local version="${archive#MinhSparkOffice-}"
  version="${version%-macos-arm64.app.tar.gz}"

  say "Đang tải Office 23 ${version}…"
  curl -fL --progress-bar "$BASE_URL/downloads/$archive" -o "$work/$archive" || die "tải $archive không thành công"
  local actual
  actual="$(shasum -a 256 "$work/$archive" | awk '{ print $1 }')"
  [ "$expected" = "$actual" ] || die "mã kiểm tra SHA-256 không khớp; chưa cài gì"

  mkdir -p "$work/app"
  tar -xzf "$work/$archive" -C "$work/app" || die "giải nén $archive không thành công"
  local app="$work/app/$APP_NAME"
  [ -d "$app" ] || die "gói tải về không chứa $APP_NAME"
  [ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Contents/Info.plist")" = "$BUNDLE_ID" ] || die "gói tải về không phải Office 23"
  [ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist")" = "$version" ] || die "phiên bản trong gói không khớp $version"
  strip_quarantine "$app"
  codesign --verify --deep --strict "$app" >/dev/null 2>&1 || die "chữ ký của ứng dụng không hợp lệ; chưa cài gì"

  local staged="$target_dir/.$APP_NAME.installing"
  local previous="$target_dir/.$APP_NAME.previous"
  rm -rf "$staged" "$previous"
  ditto "$app" "$staged" || { rm -rf "$staged"; die "không chép được ứng dụng vào $target_dir"; }
  strip_quarantine "$staged"

  if running_from "$destination"; then
    rm -rf "$staged"
    die "Office 23 vừa được mở trong lúc cài. Hãy thoát ứng dụng rồi chạy lại lệnh cài"
  fi
  if [ -d "$destination" ]; then
    mv "$destination" "$previous" || { rm -rf "$staged"; die "không thay được bản cũ ở $destination"; }
  fi
  if ! mv "$staged" "$destination"; then
    if [ -d "$previous" ]; then mv "$previous" "$destination"; fi
    rm -rf "$staged"
    die "không đặt được bản mới vào chỗ; bản cũ được giữ nguyên"
  fi
  rm -rf "$previous"
  if [ -d "$legacy" ] && [ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$legacy/Contents/Info.plist" 2>/dev/null)" = "$BUNDLE_ID" ]; then
    rm -rf "$legacy" && say "Đã gỡ bản cũ mang tên Minh Spark Office."
  fi
  [ "$(quarantined_items "$destination")" = 0 ] || die "macOS vẫn đánh dấu ứng dụng là tải từ Internet; chạy lại lệnh cài"
  "$LSREGISTER" -f "$destination" >/dev/null 2>&1 || true

  say "Đã cài Office 23 $version vào $destination."
  say "Từ giờ ứng dụng tự cập nhật trong mục Cập nhật ứng dụng."
  if [ "$launch" -eq 1 ]; then
    open "$destination"
  fi
}

main "$@"
