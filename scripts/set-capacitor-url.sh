#!/bin/bash
set -euo pipefail
URL="${1:?Usage: set-capacitor-url.sh <URL>}"
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s|url: \"https\{0,1\}://[^\"]*\"|url: \"${URL}\"|" capacitor.config.ts
else
  sed -i "s|url: \"https\{0,1\}://[^\"]*\"|url: \"${URL}\"|" capacitor.config.ts
fi
echo "Capacitor server URL set to: ${URL}"
