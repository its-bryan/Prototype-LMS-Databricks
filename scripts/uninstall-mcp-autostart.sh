#!/usr/bin/env bash
# Remove MCP auto-start (revert to manual start)
# Run: bash scripts/uninstall-mcp-autostart.sh

LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

echo "Unloading MCP auto-start..."
launchctl unload "$LAUNCH_AGENTS/com.mcp.resend.plist" 2>/dev/null || true
launchctl unload "$LAUNCH_AGENTS/com.mcp.twilio.plist" 2>/dev/null || true
rm -f "$LAUNCH_AGENTS/com.mcp.resend.plist"
rm -f "$LAUNCH_AGENTS/com.mcp.twilio.plist"
echo "Done. Start manually with: bash scripts/start-resend-mcp.sh  and  bash scripts/start-twilio-mcp.sh"
