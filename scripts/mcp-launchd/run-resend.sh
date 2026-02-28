#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
cd "$(dirname "$0")/../.."
[ -f .env ] && set -a && source .env && set +a
exec npx -y resend-mcp --http --port 3000
