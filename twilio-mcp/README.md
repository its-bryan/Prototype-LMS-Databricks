# Twilio MCP Server

An MCP (Model Context Protocol) server that exposes Twilio APIs to AI assistants like Cursor.

**Uses Streamable HTTP** (same pattern as Resend MCP) — you must start the server before using it in Cursor.

## Tools

- **send_sms** – Send an SMS message
- **list_phone_numbers** – List your Twilio phone numbers
- **get_account_balance** – Get your account balance
- **list_messages** – List recent SMS messages

## Setup

### 1. Install dependencies

```bash
cd twilio-mcp
npm install
```

### 2. Configure Twilio credentials

Create `twilio-mcp/.env` from the example:

```bash
cp .env.example .env
# Edit .env with your Twilio Account SID and Auth Token from https://console.twilio.com
```

### 3. Add to Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "twilio": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:3001/mcp"
    }
  }
}
```

### 4. Start the Twilio MCP server

**Before using Twilio in Cursor**, run (keep the terminal open):

```bash
bash scripts/start-twilio-mcp.sh
```

Or from the twilio-mcp directory:

```bash
cd twilio-mcp
npx tsx src/http-server.ts
```

### 5. Restart Cursor

Restart Cursor to pick up the MCP config, then use Twilio tools in chat.

## Troubleshooting

**"Error" or "ECONNREFUSED" after reloading Cursor**

The Twilio server must stay running. Reloading Cursor does not restart it, but closing the terminal does.

- **Start in foreground** (see output directly):
  ```bash
  bash scripts/start-twilio-mcp.sh
  ```
- **Start in background** (runs until you kill it):
  ```bash
  bash scripts/start-twilio-mcp-background.sh
  tail -f twilio-mcp.log   # watch output
  ```

**View Cursor MCP errors**

1. Open Command Palette (Cmd+Shift+P) → "Cursor: Open MCP Logs" or "Developer: Open Logs"
2. Or check `~/Library/Application Support/Cursor/logs/` for `Cursor MCP.log`
