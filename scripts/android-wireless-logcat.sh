#!/usr/bin/env bash
set -euo pipefail

FILTER='Purchases|RevenueCat|BillingClient|Play Billing|ConfigurationError|uk.co.mealdiary|Expo Go'

usage() {
  cat <<'EOF'
Capture Play Billing / RevenueCat logs from a physical Android device over Wi-Fi.

First time (phone UI):
  Settings → Developer options → Wireless debugging → ON
  Pair device with pairing code

Then:
  npm run logcat:android -- --pair IP:PAIR_PORT PAIR_CODE
  npm run logcat:android -- --connect IP:PORT
  npm run logcat:android

--connect uses the IP:port shown on the Wireless debugging screen (not the pairing port).
Reproduce the Plans error on the phone after "Waiting for device logs".
Ctrl-C to stop.
EOF
}

ensure_adb() {
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb not found. Install Android platform-tools." >&2
    exit 1
  fi
  adb start-server >/dev/null
}

pick_serial() {
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    echo "$ANDROID_SERIAL"
    return
  fi

  # Prefer IP:port over the duplicate mDNS name for the same phone.
  local serial
  serial="$(adb devices | awk 'NR>1 && $2=="device" && $1 ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:/{print $1; exit}')"
  if [[ -z "$serial" ]]; then
    serial="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
  fi
  echo "$serial"
}

wait_for_device() {
  SERIAL="$(pick_serial)"
  if [[ -z "$SERIAL" ]]; then
    echo "No device connected. Enable Wireless debugging, then rerun with --pair / --connect."
    echo
    usage
    exit 1
  fi
  echo "Using device $SERIAL"
}

adb_s() {
  adb -s "$SERIAL" "$@"
}

follow_logs() {
  echo "Clearing log buffer, then following RevenueCat / Play Billing lines…"
  echo "Reproduce the error on the phone now."
  echo
  adb_s logcat -c
  adb_s logcat -v time | rg --line-buffered -i "$FILTER"
}

ensure_adb

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--pair" ]]; then
  host="${2:-}"
  code="${3:-}"
  if [[ -z "$host" || -z "$code" ]]; then
    echo "Usage: npm run logcat:android -- --pair IP:PAIR_PORT PAIR_CODE" >&2
    exit 1
  fi
  adb pair "$host" "$code"
  shift 3 || true
fi

if [[ "${1:-}" == "--connect" ]]; then
  host="${2:-}"
  if [[ -z "$host" ]]; then
    echo "Usage: npm run logcat:android -- --connect IP:PORT" >&2
    exit 1
  fi
  adb connect "$host"
  shift 2 || true
fi

adb devices -l
wait_for_device
follow_logs
