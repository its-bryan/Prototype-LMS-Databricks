#!/usr/bin/env bash
# Start Resend MCP server in HTTP mode (required for Cursor to connect)
# Run: bash scripts/start-resend-mcp.sh
# Keep this terminal open while using Resend

export RESEND_API_KEY="${RESEND_API_KEY:-re_Pfe5ik4E_74VzjkJNH1gyGS1kZ364XeGu}"
npx -y resend-mcp --http --port 3000
