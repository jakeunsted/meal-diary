#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

npm install --os="${NPM_OS}" --cpu="${NPM_CPU}" \
  --workspace=meal-diary-marketing \
  --ignore-scripts

sh scripts/install-marketing-native-deps.sh
