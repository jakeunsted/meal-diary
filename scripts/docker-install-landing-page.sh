#!/bin/sh
set -e

. "$(dirname "$0")/linux-platform.sh"

npm install --os="${NPM_OS}" --cpu="${NPM_CPU}" \
  --workspace=landing-page \
  --ignore-scripts

sh scripts/install-landing-page-native-deps.sh
