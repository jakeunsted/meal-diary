#!/bin/sh
set -e

npm install --workspace=nuxt-app --workspace=@meal-diary/shared --ignore-scripts
sh scripts/install-frontend-native-deps.sh
