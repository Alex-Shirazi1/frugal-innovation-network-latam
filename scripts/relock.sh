#!/usr/bin/env bash
# Regenerates package-lock.json with every platform's optional dependencies.
#
# npm prunes optional platform packages it does not need on the CURRENT machine,
# which silently breaks `npm ci` on Linux CI after any dependency change made on
# macOS. Resolving with node_modules moved aside gives npm nothing to prune
# against, producing the full cross-platform graph.
set -euo pipefail
cd "$(dirname "$0")/.."
STASH="$(mktemp -d)/node_modules"
echo "moving node_modules aside…"
[ -d node_modules ] && mv node_modules "$STASH"
rm -f package-lock.json
echo "resolving full dependency graph…"
npm install --package-lock-only --silent
echo "reinstalling from the new lock…"
npm ci --silent
[ -d "$STASH" ] && rm -rf "$STASH"
node -e "
const l=require('./package-lock.json');
const k=Object.keys(l.packages);
const need=['@emnapi/runtime','@emnapi/core'];
const missing=need.filter(n=>!k.some(x=>x.endsWith(n)));
if (missing.length) { console.error('STILL MISSING:', missing); process.exit(1); }
for (const p of ['linux-x64-gnu','darwin-arm64','win32-x64'])
  console.log('  '+p+':', k.filter(x=>x.includes(p)).length, 'entries');
console.log('lockfile is cross-platform');
"
