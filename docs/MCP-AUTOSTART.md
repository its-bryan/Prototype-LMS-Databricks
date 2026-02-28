# MCP Auto-Start (Like Linear)

Linear's MCP works after every Cursor reload because it's **hosted remotely** — always running on Linear's servers. Resend and Twilio run **locally** and must be started manually — unless you install auto-start.

## One-Time Setup: Make Resend & Twilio Always Available

```bash
# 1. Add Resend API key to project .env (if not already)
echo "RESEND_API_KEY=re_your_key_here" >> .env

# 2. Install auto-start (runs on login, restarts if crashed)
bash scripts/install-mcp-autostart.sh
```

After this, Resend and Twilio MCP servers start automatically when you log in — no manual start needed. They'll keep running in the background like Linear.

## How It Works

- **Linear**: Remote URL `https://mcp.linear.app/mcp` — Linear hosts it
- **Resend & Twilio**: Local servers on ports 3000 and 3001 — we use **launchd** (macOS) to start them on login and keep them running

## Commands

| Action | Command |
|--------|---------|
| Install auto-start | `bash scripts/install-mcp-autostart.sh` |
| Uninstall | `bash scripts/uninstall-mcp-autostart.sh` |
| View Resend logs | `tail -f resend-mcp.log` |
| View Twilio logs | `tail -f twilio-mcp.log` |
| Stop Resend | `launchctl unload ~/Library/LaunchAgents/com.mcp.resend.plist` |
| Stop Twilio | `launchctl unload ~/Library/LaunchAgents/com.mcp.twilio.plist` |
