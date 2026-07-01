#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

npm install --workspace=meal-diary-api --workspace=@meal-diary/shared --ignore-scripts

npm install --workspace=meal-diary-api \
  "@esbuild/${LINUX_ESBUILD_ARCH}@0.28.1"

npm rebuild bcrypt --build-from-source --workspace=meal-diary-api
