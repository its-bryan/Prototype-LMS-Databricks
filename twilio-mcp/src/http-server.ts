#!/usr/bin/env node
/**
 * Twilio MCP Server - Streamable HTTP mode (like Resend)
 * Run with: bash scripts/start-twilio-mcp.sh (loads .env automatically)
 * Or: cd twilio-mcp && npx tsx src/http-server.ts (set env vars first)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express";
import { z } from "zod";
import twilio from "twilio";

const PORT = parseInt(process.env.TWILIO_MCP_PORT || "3001", 10);

function getServer() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

  const server = new McpServer({
    name: "twilio-mcp-server",
    version: "1.0.0",
  });

  function requireClient() {
    if (!client) {
      throw new Error(
        "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
      );
    }
    return client;
  }

  server.registerTool(
    "send_sms",
    {
      title: "Send SMS",
      description: "Send an SMS message via Twilio",
      inputSchema: {
        to: z.string().describe("Phone number (E.164, e.g. +14155551234)"),
        from: z.string().describe("Twilio phone number to send from"),
        body: z.string().describe("Message body"),
      },
    },
    async ({ to, from, body }) => {
      const twilioClient = requireClient();
      const message = await twilioClient.messages.create({ to, from, body });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { sid: message.sid, status: message.status, to: message.to, body: message.body },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_phone_numbers",
    {
      title: "List Phone Numbers",
      description: "List Twilio phone numbers in your account",
      inputSchema: {
        limit: z.number().min(1).max(100).default(20).optional(),
      },
    },
    async ({ limit = 20 }) => {
      const twilioClient = requireClient();
      const numbers = await twilioClient.incomingPhoneNumbers.list({ limit });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              numbers.map((n) => ({ sid: n.sid, phoneNumber: n.phoneNumber, friendlyName: n.friendlyName })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_account_balance",
    {
      title: "Get Account Balance",
      description: "Get your Twilio account balance",
      inputSchema: {},
    },
    async () => {
      const twilioClient = requireClient();
      const balance = await twilioClient.balance.fetch();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ balance: balance.balance, currency: balance.currency }, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_messages",
    {
      title: "List Messages",
      description: "List recent SMS messages",
      inputSchema: {
        limit: z.number().min(1).max(50).default(10).optional(),
        to: z.string().optional().describe("Filter by recipient"),
        from: z.string().optional().describe("Filter by sender"),
      },
    },
    async ({ limit = 10, to, from }) => {
      const twilioClient = requireClient();
      const messages = await twilioClient.messages.list({
        limit,
        to: to || undefined,
        from: from || undefined,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              messages.map((m) => ({
                sid: m.sid,
                to: m.to,
                from: m.from,
                body: m.body,
                status: m.status,
                dateCreated: m.dateCreated,
              })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

const app = createMcpExpressApp();

app.post("/mcp", async (req, res) => {
  const server = getServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("[twilio-mcp] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  }));
});

app.listen(PORT, () => {
  console.log(`Twilio MCP server listening on http://127.0.0.1:${PORT}/mcp`);
});

process.on("SIGINT", () => {
  process.exit(0);
});
