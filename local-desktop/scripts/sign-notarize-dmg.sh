#!/usr/bin/env bash
set -u

# Sign + notarize + staple latest macOS DMG artifact.
# Defaults can be overridden via environment variables:
#   SIGN_IDENTITY
#   KEYCHAIN_PROFILE
#   TEAM_ID
#   APP_NAME_PREFIX

SIGN_IDENTITY="${SIGN_IDENTITY:-Developer ID Application: cao li (F86TJ26842)}"
KEYCHAIN_PROFILE="${KEYCHAIN_PROFILE:-clawheart-sign}"
TEAM_ID="${TEAM_ID:-F86TJ26842}"
APP_NAME_PREFIX="${APP_NAME_PREFIX:-ClawHeart Desktop Core}"

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

latest_build_dir="$(ls -dt "${PROJECT_ROOT}"/build-output-* 2>/dev/null | head -n 1)"
if [[ -z "${latest_build_dir}" || ! -d "${latest_build_dir}" ]]; then
  fail "Failed to detect latest build-output-* directory"
fi

log "Latest build directory: ${latest_build_dir}"

# Prefer the exact Core arm64 name pattern, then fallback to any arm64 DMG.
shopt -s nullglob
preferred_dmgs=( "${latest_build_dir}/${APP_NAME_PREFIX}"*-arm64.dmg )
fallback_dmgs=( "${latest_build_dir}"/*-arm64.dmg )
shopt -u nullglob

if [[ ${#preferred_dmgs[@]} -gt 0 ]]; then
  dmg_path="${preferred_dmgs[0]}"
elif [[ ${#fallback_dmgs[@]} -gt 0 ]]; then
  dmg_path="${fallback_dmgs[0]}"
else
  fail "No arm64 DMG found under ${latest_build_dir}"
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
