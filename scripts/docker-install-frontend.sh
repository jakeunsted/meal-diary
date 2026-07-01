#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

npm install --os="${NPM_OS}" --cpu="${NPM_CPU}" \
  --workspace=nuxt-app \
  --workspace=@meal-diary/shared \
  --ignore-scripts

sh scripts/install-frontend-native-deps.sh
