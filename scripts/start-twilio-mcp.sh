#!/usr/bin/env bash
# Start Twilio MCP server in HTTP mode (required for Cursor to connect)
# Run: bash scripts/start-twilio-mcp.sh
# Keep this terminal open while using Twilio MCP

cd "$(dirname "$0")/../twilio-mcp"
# Load .env if it exists (create from .env.example)
[ -f .env ] && set -a && source .env && set +a
export TWILIO_MCP_PORT="${TWILIO_MCP_PORT:-3001}"
npx -y tsx src/http-server.ts
