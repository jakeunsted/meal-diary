#!/bin/sh
set -e

npm install --workspace=meal-diary-api --workspace=@meal-diary/shared --ignore-scripts
npm rebuild bcrypt --build-from-source --workspace=meal-diary-api
