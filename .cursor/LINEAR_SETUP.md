# Linear Workspace Setup — Hertz LMS

This project uses the **hertz-lms** Linear workspace with team **HER**.

- **Workspace URL:** https://linear.app/hertz-lms/team/HER/all
- **Team:** HER

## Connect Cursor to hertz-lms

The Linear MCP uses OAuth. To use the hertz-lms workspace (not another workspace):

1. **Open Cursor Settings** → `Cmd/Ctrl + Shift + J` → **MCP**
2. **Remove** any existing Linear MCP server (if present)
3. **Add Linear** via [Cursor's MCP directory](https://cursor.com/docs/context/mcp/directory) or install: [Linear MCP](cursor://anysphere.cursor-deeplink/mcp/install?name=Linear&config=eyJ1cmwiOiJodHRwczovL21jcC5saW5lYXIuYXBwL21jcCJ9)
4. **Authenticate with hertz-lms:**
   - Before connecting, open https://linear.app/hertz-lms in your browser
   - Sign in to the **hertz-lms** workspace (not Ideadealer or another org)
   - When Cursor prompts for Linear auth, complete the flow while hertz-lms is your active workspace
5. **Restart Cursor** if the HER team does not appear

## Verify

After setup, Linear MCP tools should list the **HER** team. The project rules and PM commands are configured to use `team: "HER"` when creating issues.
