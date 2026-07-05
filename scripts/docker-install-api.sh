#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

echo "Installing API workspace for ${NPM_OS}/${NPM_CPU} (${LINUX_ESBUILD_ARCH})"

npm install \
  --os="${NPM_OS}" \
  --cpu="${NPM_CPU}" \
  --workspace=meal-diary-api \
  --workspace=@meal-diary/shared \
  --ignore-scripts \
  --omit=optional

npm install \
  --os="${NPM_OS}" \
  --cpu="${NPM_CPU}" \
  --workspace=meal-diary-api \
  --ignore-scripts \
  --no-save \
  "@esbuild/${LINUX_ESBUILD_ARCH}@0.28.1"

npm rebuild bcrypt --build-from-source --workspace=meal-diary-api
