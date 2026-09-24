#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node_version="24.18.0"
pi_version="0.85.1"
packages=(
	pi-mcp-adapter@2.33.0
	pi-deepseek-search@1.0.20
	pi-web-access@0.29.0
	@juicesharp/rpiv-ask-user-question@2.10.0
	@juicesharp/rpiv-config@2.10.0
	@tintinweb/pi-subagents@0.19.0
	@dietrichgebert/ponytail@4.9.0
	@gotgenes/pi-permission-system@32.0.2
	pi-auto-fallback@0.1.1
	pi-worktree@1.3.3
)

if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
	npm install -g n
	n "$node_version"
	hash -r
fi

npm install -g "@earendil-works/pi-coding-agent@${pi_version}"
npm install --prefix "$repo"
mkdir -p "$repo/npm"
npm install --prefix "$repo/npm" --no-fund --no-audit "${packages[@]}"

node "$repo/patches/apply.mjs" || echo "patches/apply.mjs reported a patch that needs porting; see patches/README.md"
