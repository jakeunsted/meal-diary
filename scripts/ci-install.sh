#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

echo "CI install for ${NPM_OS}/${NPM_CPU} (${LINUX_ESBUILD_ARCH})"

npm ci \
  --ignore-scripts \
  --omit=optional \
  --os="${NPM_OS}" \
  --cpu="${NPM_CPU}"

npm install \
  --os="${NPM_OS}" \
  --cpu="${NPM_CPU}" \
  --workspace=meal-diary-api \
  --ignore-scripts \
  --no-save \
  "@esbuild/${LINUX_ESBUILD_ARCH}@0.28.1"

npm rebuild bcrypt --build-from-source --workspace=meal-diary-api

sh scripts/install-frontend-native-deps.sh
