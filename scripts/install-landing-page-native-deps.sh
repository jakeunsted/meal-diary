#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

npm_platform_flags="--os=${NPM_OS} --cpu=${NPM_CPU}"

oxc_version="0.132.0"
oxide_version="4.3.0"

# Lockfile is often generated on macOS; install for the actual Linux build CPU.
npm install ${npm_platform_flags} \
  --workspace=landing-page \
  --ignore-scripts \
  --include=optional

npm install ${npm_platform_flags} \
  --workspace=landing-page \
  --ignore-scripts \
  --no-save \
  "@esbuild/${LINUX_ESBUILD_ARCH}@0.25.12" \
  "@esbuild/${LINUX_ESBUILD_ARCH}@0.28.1" \
  "@oxc-parser/binding-${oxc_platform}@${oxc_version}" \
  "@tailwindcss/oxide-linux-${arch_suffix}@${oxide_version}"

npm run postinstall --workspace=landing-page
