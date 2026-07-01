#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

npm_platform_flags="--os=${NPM_OS} --cpu=${NPM_CPU}"

npm install ${npm_platform_flags} \
  --workspace=meal-diary-api \
  --workspace=@meal-diary/shared \
  --ignore-scripts

npm install ${npm_platform_flags} \
  --workspace=meal-diary-api \
  --ignore-scripts \
  "@esbuild/${LINUX_ESBUILD_ARCH}@0.28.1"

npm rebuild bcrypt --build-from-source --workspace=meal-diary-api
