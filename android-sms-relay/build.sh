#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Read a key from local.properties
get_prop() {
  [ -f local.properties ] && grep "^${1}=" local.properties | cut -d= -f2- | tr -d '\r' || true
}

SERVER_URL="${SERVER_URL:-$(get_prop SERVER_URL)}"
API_SECRET="${API_SECRET:-$(get_prop API_SECRET)}"

BUILD_TYPE="${1:-debug}"

echo "Building APK (${BUILD_TYPE})..."
docker build \
  --build-arg "SERVER_URL=${SERVER_URL}" \
  --build-arg "API_SECRET=${API_SECRET}" \
  --tag android-sms-relay:latest \
  .

echo "Extracting APK..."
CONTAINER=$(docker create android-sms-relay:latest)
docker cp "${CONTAINER}:/app/app/build/outputs/apk/${BUILD_TYPE}/app-${BUILD_TYPE}.apk" "./app-${BUILD_TYPE}.apk"
docker rm "${CONTAINER}" > /dev/null

echo "Done: $(pwd)/app-${BUILD_TYPE}.apk"
