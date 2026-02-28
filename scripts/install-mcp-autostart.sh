#!/usr/bin/env bash
# Install Resend and Twilio MCP servers to run automatically on login (like Linear - always available)
# Run once: bash scripts/install-mcp-autostart.sh

set -e
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

echo "Installing MCP auto-start (launchd)..."

# Wrapper scripts for launchd
mkdir -p "$PROJECT_ROOT/scripts/mcp-launchd"

# Resend wrapper - load nvm/node then run (launchd has minimal PATH)
cat > "$PROJECT_ROOT/scripts/mcp-launchd/run-resend.sh" << 'WRAPPER'
#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
cd "$(dirname "$0")/../.."
[ -f .env ] && set -a && source .env && set +a
exec npx -y resend-mcp --http --port 3000
WRAPPER

# Twilio wrapper
cat > "$PROJECT_ROOT/scripts/mcp-launchd/run-twilio.sh" << 'WRAPPER'
#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
cd "$(dirname "$0")/../../twilio-mcp"
[ -f .env ] && set -a && source .env && set +a
export TWILIO_MCP_PORT="${TWILIO_MCP_PORT:-3001}"
exec npx -y tsx src/http-server.ts
WRAPPER

chmod +x "$PROJECT_ROOT/scripts/mcp-launchd/run-resend.sh"
chmod +x "$PROJECT_ROOT/scripts/mcp-launchd/run-twilio.sh"

# Resend plist (simplified)
cat > "$LAUNCH_AGENTS/com.mcp.resend.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mcp.resend</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PROJECT_ROOT/scripts/mcp-launchd/run-resend.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$PROJECT_ROOT</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$PROJECT_ROOT/resend-mcp.log</string>
  <key>StandardErrorPath</key>
  <string>$PROJECT_ROOT/resend-mcp.log</string>
</dict>
</plist>
EOF

# Twilio plist
cat > "$LAUNCH_AGENTS/com.mcp.twilio.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mcp.twilio</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PROJECT_ROOT/scripts/mcp-launchd/run-twilio.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$PROJECT_ROOT</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$PROJECT_ROOT/twilio-mcp.log</string>
  <key>StandardErrorPath</key>
  <string>$PROJECT_ROOT/twilio-mcp.log</string>
</dict>
</plist>
EOF

# Reload services (unload first to pick up script changes)
launchctl unload "$LAUNCH_AGENTS/com.mcp.resend.plist" 2>/dev/null || true
launchctl unload "$LAUNCH_AGENTS/com.mcp.twilio.plist" 2>/dev/null || true
sleep 1
launchctl load "$LAUNCH_AGENTS/com.mcp.resend.plist"
launchctl load "$LAUNCH_AGENTS/com.mcp.twilio.plist"

echo "Done! Resend and Twilio MCP now start automatically on login (like Linear)."
echo ""
echo "If you still see errors, check logs: tail -f resend-mcp.log  tail -f twilio-mcp.log"
echo ""
echo "To add Resend API key to .env: echo 'RESEND_API_KEY=re_xxx' >> $PROJECT_ROOT/.env"
echo "Twilio uses twilio-mcp/.env (already configured)"
echo ""
echo "Logs: tail -f $PROJECT_ROOT/resend-mcp.log  or  tail -f $PROJECT_ROOT/twilio-mcp.log"
echo "Stop: launchctl unload ~/Library/LaunchAgents/com.mcp.resend.plist"
