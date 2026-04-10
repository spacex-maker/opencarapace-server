#!/usr/bin/env bash
set -u

# Sign + notarize + staple macOS DMG (arm64 / Intel x64 流程相同：codesign → notarytool → stapler → spctl).
# Environment variables:
#   SIGN_IDENTITY
#   KEYCHAIN_PROFILE
#   TEAM_ID
#   APP_NAME_PREFIX   与 DMG 文件名一致的前缀（默认完整版 ClawHeart Desktop；Core 用 ClawHeart Desktop Core）
#   DMG_ARCH          arm64 | x64 | auto（默认 auto）
#   DMG_BUILD_DIR     指定某次 build-output-* 目录；不设则用最新时间戳目录
#   DMG_PATH          直接指定 .dmg 绝对路径时跳过自动查找

SIGN_IDENTITY="${SIGN_IDENTITY:-Developer ID Application: cao li (F86TJ26842)}"
KEYCHAIN_PROFILE="${KEYCHAIN_PROFILE:-clawheart-sign}"
TEAM_ID="${TEAM_ID:-F86TJ26842}"
APP_NAME_PREFIX="${APP_NAME_PREFIX:-ClawHeart Desktop}"
DMG_ARCH="${DMG_ARCH:-auto}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() {
  printf "[%s] %s\n" "$(date "+%H:%M:%S")" "$1"
}

fail() {
  printf "ERROR: %s\n" "$1" >&2
  exit 1
}

run_step() {
  local description="$1"
  shift
  log "$description"
  "$@"
  local status=$?
  if [[ $status -ne 0 ]]; then
    fail "${description} failed (exit code: ${status})"
  fi
}

if [[ ! -d "${PROJECT_ROOT}" ]]; then
  fail "Project root not found: ${PROJECT_ROOT}"
fi

shopt -s nullglob
build_dirs=( "${PROJECT_ROOT}"/build-output-* )
shopt -u nullglob
if [[ ${#build_dirs[@]} -eq 0 ]]; then
  fail "No build-output-* directories found under ${PROJECT_ROOT}"
fi

if [[ -n "${DMG_BUILD_DIR:-}" ]]; then
  build_dir="${DMG_BUILD_DIR}"
  if [[ ! -d "${build_dir}" ]]; then
    fail "DMG_BUILD_DIR is not a directory: ${build_dir}"
  fi
else
  build_dir="$(ls -dt "${PROJECT_ROOT}"/build-output-* 2>/dev/null | head -n 1)"
  if [[ -z "${build_dir}" || ! -d "${build_dir}" ]]; then
    fail "Failed to detect latest build-output-* directory"
  fi
fi

log "Build directory: ${build_dir}"
log "APP_NAME_PREFIX=${APP_NAME_PREFIX}  DMG_ARCH=${DMG_ARCH}"

# electron-builder 可能产出：
#   ClawHeart Desktop-0.1.0-arm64.dmg / …-x64.dmg
#   或单架构时 ClawHeart Desktop-0.1.0.dmg（无架构后缀）
pick_first() {
  # shellcheck disable=SC2206
  local -a arr=( "$@" )
  if [[ ${#arr[@]} -gt 0 ]]; then
    printf '%s' "${arr[0]}"
  fi
}

# 前缀匹配且文件名不含 -arm64 / -x64 的 DMG（如 ClawHeart Desktop-0.1.0.dmg）
pick_plain_prefixed_dmg() {
  local dir="$1" prefix="$2"
  shopt -s nullglob
  local f
  for f in "${dir}/${prefix}"-*.dmg; do
    [[ "$f" == *-arm64.dmg ]] && continue
    [[ "$f" == *-x64.dmg ]] && continue
    printf '%s' "$f"
    shopt -u nullglob
    return 0
  done
  shopt -u nullglob
  return 1
}

dmg_path=""
if [[ -n "${DMG_PATH:-}" ]]; then
  dmg_path="${DMG_PATH}"
  if [[ ! -f "${dmg_path}" ]]; then
    fail "DMG_PATH is not a file: ${dmg_path}"
  fi
else
  shopt -s nullglob

  if [[ "${DMG_ARCH}" == "arm64" || "${DMG_ARCH}" == "x64" ]]; then
    suf="${DMG_ARCH}.dmg"
    preferred=( "${build_dir}/${APP_NAME_PREFIX}"*"-${suf}" )
    fallback=( "${build_dir}"/*"-${suf}" )
    dmg_path="$(pick_first "${preferred[@]}")"
    if [[ -z "${dmg_path}" ]]; then
      dmg_path="$(pick_first "${fallback[@]}")"
    fi
    if [[ -z "${dmg_path}" ]]; then
      dmg_path="$(pick_plain_prefixed_dmg "${build_dir}" "${APP_NAME_PREFIX}")" || true
    fi
    if [[ -z "${dmg_path}" ]]; then
      fail "No *-${suf} or ${APP_NAME_PREFIX}-<version>.dmg under ${build_dir}"
    fi
  elif [[ "${DMG_ARCH}" == "auto" ]]; then
    p_arm=( "${build_dir}/${APP_NAME_PREFIX}"*-arm64.dmg )
    p_x64=( "${build_dir}/${APP_NAME_PREFIX}"*-x64.dmg )
    f_arm=( "${build_dir}"/*-arm64.dmg )
    f_x64=( "${build_dir}"/*-x64.dmg )
    if [[ ${#p_arm[@]} -gt 0 ]]; then
      dmg_path="${p_arm[0]}"
    elif [[ ${#p_x64[@]} -gt 0 ]]; then
      dmg_path="${p_x64[0]}"
    elif [[ ${#f_arm[@]} -gt 0 ]]; then
      dmg_path="${f_arm[0]}"
    elif [[ ${#f_x64[@]} -gt 0 ]]; then
      dmg_path="${f_x64[0]}"
    else
      dmg_path="$(pick_plain_prefixed_dmg "${build_dir}" "${APP_NAME_PREFIX}")" || true
    fi
    if [[ -z "${dmg_path}" ]]; then
      fail "No .dmg under ${build_dir} (tried *-arm64, *-x64, ${APP_NAME_PREFIX}-<version>.dmg)"
    fi
  else
    fail "Invalid DMG_ARCH=${DMG_ARCH} (use arm64, x64, or auto)"
  fi
  shopt -u nullglob
fi

if [[ ! -f "${dmg_path}" ]]; then
  fail "DMG file not found: ${dmg_path}"
fi

log "Target DMG: ${dmg_path}"
log "Sign identity: ${SIGN_IDENTITY}"
log "Notary keychain profile: ${KEYCHAIN_PROFILE}"
log "Team ID: ${TEAM_ID}"

run_step "Codesigning DMG" \
  codesign --force --sign "${SIGN_IDENTITY}" "${dmg_path}"

run_step "Verifying codesign result" \
  codesign --verify --verbose=2 "${dmg_path}"

run_step "Submitting for notarization (wait for completion)" \
  xcrun notarytool submit "${dmg_path}" --keychain-profile "${KEYCHAIN_PROFILE}" --team-id "${TEAM_ID}" --wait

run_step "Stapling notarization ticket" \
  xcrun stapler staple "${dmg_path}"

run_step "Final Gatekeeper verification (spctl)" \
  spctl -a -v --type install "${dmg_path}"

log "All done. Signed and notarized DMG: ${dmg_path}"
