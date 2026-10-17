#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

npm install --os="${NPM_OS}" --cpu="${NPM_CPU}" \
  --workspace=meal-diary-marketing \
  --ignore-scripts

# Nuxt prepare (postinstall) needs the workspace available
npm run postinstall --workspace=meal-diary-marketing || npx --workspace=meal-diary-marketing nuxt prepare
