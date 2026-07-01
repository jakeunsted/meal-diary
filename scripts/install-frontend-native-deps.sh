#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

npm_platform_flags="--os=${NPM_OS} --cpu=${NPM_CPU}"

oxc_version="0.132.0"
lightningcss_version="1.32.0"
oxide_version="4.3.0"
rollup_version="4.60.3"
rolldown_version="1.0.3"

# Lockfile is often generated on macOS; install for the actual Linux build CPU.
npm install ${npm_platform_flags} \
  --workspace=nuxt-app \
  --ignore-scripts \
  --include=optional

npm install ${npm_platform_flags} \
  --workspace=nuxt-app \
  --ignore-scripts \
  --no-save \
  "@esbuild/${LINUX_ESBUILD_ARCH}@0.25.12" \
  "@esbuild/${LINUX_ESBUILD_ARCH}@0.28.1" \
  "@oxc-parser/binding-${oxc_platform}@${oxc_version}" \
  "@oxc-transform/binding-${oxc_platform}@${oxc_version}" \
  "@oxc-minify/binding-${oxc_platform}@${oxc_version}" \
  "lightningcss-linux-${arch_suffix}@${lightningcss_version}" \
  "@tailwindcss/oxide-linux-${arch_suffix}@${oxide_version}" \
  "@rollup/rollup-linux-${arch_suffix}@${rollup_version}" \
  "@rolldown/binding-linux-${arch_suffix}@${rolldown_version}"

npm run postinstall --workspace=nuxt-app
