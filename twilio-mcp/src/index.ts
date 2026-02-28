#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";
import twilio from "twilio";

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
      "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables."
    );
  }
  return client;
}

// Send SMS
server.registerTool(
  "send_sms",
  {
    title: "Send SMS",
    description: "Send an SMS message via Twilio",
    inputSchema: z.object({
      to: z.string().describe("Phone number to send to (E.164 format, e.g. +14155551234)"),
      from: z.string().describe("Twilio phone number to send from"),
      body: z.string().describe("Message body"),
    }),
  },
  async ({ to, from, body }) => {
    const twilioClient = requireClient();
    const message = await twilioClient.messages.create({ to, from, body });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              sid: message.sid,
              status: message.status,
              to: message.to,
              body: message.body,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// List phone numbers
server.registerTool(
  "list_phone_numbers",
  {
    title: "List Phone Numbers",
    description: "List Twilio phone numbers in your account",
    inputSchema: z.object({
      limit: z.number().min(1).max(100).default(20).optional(),
    }),
  },
  async ({ limit = 20 }) => {
    const twilioClient = requireClient();
    const numbers = await twilioClient.incomingPhoneNumbers.list({ limit });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            numbers.map((n) => ({
              sid: n.sid,
              phoneNumber: n.phoneNumber,
              friendlyName: n.friendlyName,
            })),
            null,
            2
          ),
        },
      ],
    };
  }
);

// Get account balance
server.registerTool(
  "get_account_balance",
  {
    title: "Get Account Balance",
    description: "Get your Twilio account balance",
    inputSchema: z.object({}),
  },
  async () => {
    const twilioClient = requireClient();
    const balance = await twilioClient.balance.fetch();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              balance: balance.balance,
              currency: balance.currency,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// List recent messages
server.registerTool(
  "list_messages",
  {
    title: "List Messages",
    description: "List recent SMS messages",
    inputSchema: z.object({
      limit: z.number().min(1).max(50).default(10).optional(),
      to: z.string().optional().describe("Filter by recipient"),
      from: z.string().optional().describe("Filter by sender"),
    }),
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

const transport = new StdioServerTransport();
await server.connect(transport).catch((err) => {
  console.error("[twilio-mcp] Failed to start:", err);
  process.exit(1);
});
