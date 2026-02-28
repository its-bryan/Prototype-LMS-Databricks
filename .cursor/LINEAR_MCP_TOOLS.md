# Linear MCP Tools – Minimal Setup for Tickets

This project uses a reduced set of Linear MCP tools focused on creating and managing tickets.

## Tools Enabled (13 tools)

| Tool | Purpose |
|------|---------|
| `save_issue` | Create and update tickets |
| `list_issues` | List and search tickets |
| `get_issue` | Get ticket details |
| `list_teams` | List teams (required when creating issues) |
| `get_team` | Get team details |
| `list_issue_statuses` | List workflow statuses |
| `list_comments` | View ticket comments |
| `create_comment` | Add comments to tickets |
| `list_issue_labels` | List labels for tagging |
| `list_projects` | List projects for assignment |
| `get_project` | Get project details |
| `list_users` | List users for assignees |
| `get_user` | Get user details |

## Tools Disabled (if X-MCP-Tools is supported)

- **Attachments** – get, create, delete
- **Documents** – get, list, create, update
- **Cycles** – list
- **Milestones** – list, get, save
- **Project labels** – list
- **Create issue label** – create new labels
- **Save project** – create/update projects
- **Extract images** – image extraction from markdown
- **Search documentation** – Linear docs search

## Configuration

The `mcp.json` uses the `X-MCP-Tools` header to request only the tools above. **Note:** Linear may not support this header (it’s documented for GitHub’s MCP server). If all tools still load, use one of the alternatives below.

## If X-MCP-Tools Doesn’t Work

### Option A: Cursor UI (quick)

1. Open **Cursor Settings** → **MCP**
2. Find the **Linear** server
3. Click each tool you want to **disable** (they will appear greyed out)

This may reset after Cursor restarts.

### Option B: Tool-filter MCP proxy (persistent)

Use a proxy that filters tools before they reach Cursor:

```bash
npx @respawn-app/tool-filter-mcp --upstream https://mcp.linear.app/mcp --deny "attachment|document|cycle|milestone|extract_images|search_documentation|create_issue_label|save_project|project_labels"
```

Then point `mcp.json` at the proxy URL (e.g. `http://localhost:3000/sse`) instead of Linear. OAuth with Linear may need extra setup when using a proxy.

### Option C: Add tools back

If you need more tools (e.g. attachments, documents), add them to the `X-MCP-Tools` comma-separated list in `mcp.json`.
