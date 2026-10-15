#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
wrangler whoami
npm run build:all
node scripts/verify.mjs
npm run deploy:main
npm run deploy:wedding
npm run deploy:portrait
