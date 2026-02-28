#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
cd "$(dirname "$0")/../../twilio-mcp"
[ -f .env ] && set -a && source .env && set +a
export TWILIO_MCP_PORT="${TWILIO_MCP_PORT:-3001}"
exec npx -y tsx src/http-server.ts
