#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

npm_platform_flags="--os=${NPM_OS} --cpu=${NPM_CPU}"

oxc_parser_version="0.89.0"
lightningcss_version="1.32.0"
oxide_version="4.3.3"
rollup_version="4.63.2"
rolldown_version="1.1.5"

# Lockfile is often generated on macOS; install for the actual Linux build CPU.
npm install ${npm_platform_flags} \
  --workspace=meal-diary-marketing \
  --ignore-scripts \
  --include=optional

npm install ${npm_platform_flags} \
  --workspace=meal-diary-marketing \
  --ignore-scripts \
  --no-save \
  "@esbuild/${LINUX_ESBUILD_ARCH}@0.25.12" \
  "@esbuild/${LINUX_ESBUILD_ARCH}@0.28.2" \
  "@oxc-parser/binding-${oxc_platform}@${oxc_parser_version}" \
  "lightningcss-linux-${arch_suffix}@${lightningcss_version}" \
  "@tailwindcss/oxide-linux-${arch_suffix}@${oxide_version}" \
  "@rollup/rollup-linux-${arch_suffix}@${rollup_version}" \
  "@rolldown/binding-linux-${arch_suffix}@${rolldown_version}"

npm run postinstall --workspace=meal-diary-marketing
