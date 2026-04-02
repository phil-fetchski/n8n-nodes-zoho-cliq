#!/usr/bin/env bash

set -euo pipefail

readonly TARBALL_PATH_INPUT="${1:-}"
readonly SUCCESS_MESSAGE="${2:-✅ Package tarball surface is valid}"

WORK_DIR="$(mktemp -d)"
NPM_CACHE_DIR="${npm_config_cache:-$WORK_DIR/npm-cache}"

cleanup() {
	rm -rf "$WORK_DIR"
}

trap cleanup EXIT

TARBALL_PATH="$TARBALL_PATH_INPUT"
mkdir -p "$NPM_CACHE_DIR"

if [[ -z "$TARBALL_PATH" ]]; then
	npm_config_cache="$NPM_CACHE_DIR" npm pack --pack-destination "$WORK_DIR" >/dev/null
	TARBALL_PATH="$(find "$WORK_DIR" -maxdepth 1 -name '*.tgz' -print -quit)"
fi

if [[ -z "$TARBALL_PATH" || ! -f "$TARBALL_PATH" ]]; then
	echo "❌ Package tarball was not created"
	exit 1
fi

CONTENTS_PATH="$WORK_DIR/tarball-contents.txt"
tar -tzf "$TARBALL_PATH" > "$CONTENTS_PATH"

grep -Fx 'package/package.json' "$CONTENTS_PATH" >/dev/null || (echo "❌ Missing package/package.json in tarball" && exit 1)
grep -Fx 'package/README.md' "$CONTENTS_PATH" >/dev/null || (echo "❌ Missing package/README.md in tarball" && exit 1)
grep -Fx 'package/LICENSE' "$CONTENTS_PATH" >/dev/null || (echo "❌ Missing package/LICENSE in tarball" && exit 1)
grep -Fx 'package/dist/nodes/ZohoCliq/ZohoCliq.node.js' "$CONTENTS_PATH" >/dev/null || (echo "❌ Missing node entrypoint in tarball" && exit 1)
grep -Fx 'package/dist/credentials/ZohoCliqOAuth2Api.credentials.js' "$CONTENTS_PATH" >/dev/null || (echo "❌ Missing credential entrypoint in tarball" && exit 1)

if grep -q '^package/dist/Assets/' "$CONTENTS_PATH"; then
	echo "❌ Non-runtime dist/Assets content leaked into the tarball"
	exit 1
fi

if grep -q '^package/dist/Private/' "$CONTENTS_PATH"; then
	echo "❌ Private dist/ content leaked into the tarball"
	exit 1
fi

if grep -q '^package/dist/coverage/' "$CONTENTS_PATH"; then
	echo "❌ Coverage content leaked into the tarball"
	exit 1
fi

if grep -Eq '^package/dist/(package\.json|tsconfig\.tsbuildinfo)$' "$CONTENTS_PATH"; then
	echo "❌ Build metadata leaked into the tarball"
	exit 1
fi

if grep -q '^package/Docs/' "$CONTENTS_PATH"; then
	echo "❌ Local-only Docs/ content leaked into the tarball"
	exit 1
fi

echo "$SUCCESS_MESSAGE"
