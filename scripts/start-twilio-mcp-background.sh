#!/usr/bin/env bash
# Start Twilio MCP server in background with logging
# Output: twilio-mcp.log. Watch with: tail -f twilio-mcp.log

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT/twilio-mcp"

[ -f .env ] && set -a && source .env && set +a
export TWILIO_MCP_PORT="${TWILIO_MCP_PORT:-3001}"

LOG_FILE="$PROJECT_ROOT/twilio-mcp.log"
PID_FILE="$PROJECT_ROOT/twilio-mcp.pid"

# Kill existing if running
[ -f "$PID_FILE" ] && kill $(cat "$PID_FILE") 2>/dev/null

echo "Starting Twilio MCP server... (log: $LOG_FILE)"
npx -y tsx src/http-server.ts >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
sleep 1
if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
  echo "Server started on port ${TWILIO_MCP_PORT:-3001}. To stop: kill \$(cat $PID_FILE)"
else
  echo "Server failed to start. Check $LOG_FILE"
  tail -20 "$LOG_FILE"
fi
