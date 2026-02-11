#!/usr/bin/env bash
set -euo pipefail

# Fetch the latest Okteto CLI release version from GitHub
LATEST=$(gh api repos/okteto/okteto/releases/latest --jq '.tag_name')
CURRENT=$(sed -n "s/.*minimum = '\([^']*\)'.*/\1/p" src/download.ts)

if [ "$LATEST" = "$CURRENT" ]; then
  echo "Already at latest Okteto CLI version: $CURRENT"
  exit 0
fi

echo "Updating Okteto CLI version: $CURRENT → $LATEST"

# Update the version in download.ts
sed -i.bak "s/export const minimum = '${CURRENT}'/export const minimum = '${LATEST}'/" src/download.ts
rm -f src/download.ts.bak

echo "Updated src/download.ts"
echo ""
echo "Remaining manual steps:"
echo "  1. Bump version in package.json"
echo "  2. Add entry to CHANGELOG.md"
