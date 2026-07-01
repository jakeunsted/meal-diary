#!/bin/sh
set -e

case "$(uname -m)" in
  aarch64 | arm64)
    arch_suffix="arm64-gnu"
    oxc_platform="linux-arm64-gnu"
    ;;
  x86_64 | amd64)
    arch_suffix="x64-gnu"
    oxc_platform="linux-x64-gnu"
    ;;
  *)
    echo "Unsupported architecture for native bindings: $(uname -m)" >&2
    exit 1
    ;;
esac

oxc_version="0.132.0"
lightningcss_version="1.32.0"
oxide_version="4.3.0"
rollup_version="4.60.3"
rolldown_version="1.0.3"

# Lockfile is often generated on macOS; re-resolve Linux optional deps before lifecycle scripts.
npm install --workspace=nuxt-app --ignore-scripts --include=optional

npm install --workspace=nuxt-app --ignore-scripts \
  "@oxc-parser/binding-${oxc_platform}@${oxc_version}" \
  "@oxc-transform/binding-${oxc_platform}@${oxc_version}" \
  "@oxc-minify/binding-${oxc_platform}@${oxc_version}" \
  "lightningcss-linux-${arch_suffix}@${lightningcss_version}" \
  "@tailwindcss/oxide-linux-${arch_suffix}@${oxide_version}" \
  "@rollup/rollup-linux-${arch_suffix}@${rollup_version}" \
  "@rolldown/binding-linux-${arch_suffix}@${rolldown_version}"

npm run postinstall --workspace=nuxt-app
