# Porting LMS Prototype to Databricks Apps

> **Purpose**: Step-by-step runbook for deploying the Hertz LMS prototype (React/Vite) to a Databricks Apps environment. Written so this can be repeated on any version of the repo.

**Date started**: 2026-03-09
**Source repo (old)**: `https://github.com/popcornAlesto33/Prototype-LMS`
**Databricks-ready repo**: `https://github.com/popcornAlesto33/Prototype-LMS-Databricks`
**Target**: Client's Databricks workspace (Data Labs)

---

## How Databricks Apps Deploys Node.js Apps

When Databricks detects a `package.json` in the app root, the build pipeline runs:

1. `npm install`
2. `pip install -r requirements.txt` (if present)
3. `npm run build` (if a `build` script exists in `package.json`)
4. `npm run start` (default command, unless overridden in `app.yaml`)

**Port**: Databricks Apps expects the app to listen on **port 8000**.

**Deployment sources**: Workspace folder upload, or direct from Git (GitHub, GitLab, Bitbucket).

---

## Pre-Deployment Checklist

### Step 1: Clean AI-Tooling Files

These files are for local development with Claude Code / Cursor and must NOT ship to Databricks.

| Path | What it is | Action |
|------|-----------|--------|
| `.cursor/` | Cursor IDE config — commands, rules, MCP config, brand kit | **Delete or .gitignore** |
| `.cursor/commands/` | 25 slash commands (designer, engineer, architect, pm-*, etc.) | Part of `.cursor/` |
| `.cursor/rules/` | Brand kit, design tokens, component rules | Part of `.cursor/` |
| `.cursor/mcp.json` | MCP server config (Linear, Resend, Twilio) | Part of `.cursor/` |
| `docs/CLAUDE.md` | Claude Code project instructions | **Delete or .gitignore** |
| `docs/MCP-AUTOSTART.md` | MCP autostart setup docs | **Delete or .gitignore** |
| `docs/EDGE-FUNCTIONS-TROUBLESHOOTING.md` | Supabase edge function debug notes | **Delete or .gitignore** |
| `scripts/install-mcp-autostart.sh` | LaunchAgent installer for MCP servers | **Delete or .gitignore** |
| `scripts/uninstall-mcp-autostart.sh` | LaunchAgent uninstaller | **Delete or .gitignore** |
| `scripts/start-resend-mcp.sh` | Resend MCP server launcher | **Delete or .gitignore** |
| `scripts/start-twilio-mcp.sh` | Twilio MCP server launcher | **Delete or .gitignore** |
| `scripts/start-twilio-mcp-background.sh` | Twilio MCP background launcher | **Delete or .gitignore** |
| `scripts/mcp-launchd/` | macOS LaunchAgent plist files | **Delete or .gitignore** |
| `twilio-mcp/` | Entire Twilio MCP server package (Node.js) | **Delete or .gitignore** |
| `vercel.json` | Vercel deployment config (not needed for Databricks) | **Delete or .gitignore** |

**Keep these** (they're part of the app or useful reference):
- `src/`, `public/`, `index.html` — app source
- `package.json`, `package-lock.json` — dependencies
- `vite.config.js`, `eslint.config.js` — build config
- `.env.example` — env var template
- `supabase/` — if Supabase is used in the deployed version
- `scripts/seed-demo-users.mjs`, `scripts/test-supabase.mjs` — utility scripts
- `docs/` design/plan docs — optional, harmless

### Step 2: Make Supabase Optional (Critical)

The app uses Supabase for auth and data in the local dev environment. Databricks will NOT have Supabase credentials, so the app **must** gracefully fall back to mock data mode. Without this step, the app will crash on load with `"Supabase URL is required"`.

**2a. Make the Supabase client null-safe** (`src/lib/supabase.js`):

The client must NOT call `createClient()` when credentials are missing. Instead, export `null`:

```js
const hasValidConfig = supabaseUrl && supabaseAnonKey &&
  !supabaseUrl.includes("your-project-ref") &&
  !supabaseAnonKey.includes("your-anon-key");

export const supabase = hasValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
```

**2b. Make AuthContext skip auth when Supabase is null** (`src/context/AuthContext.jsx`):

At the top of `syncAuth`, add an early return:
```js
if (!supabase) {
  setLoading(false);
  return;
}
```

Guard the `onAuthStateChange` listener:
```js
if (!supabase) return;  // before subscribing
```

Guard `signIn`, `signOut`, and `updateProfile` methods with `if (!supabase) return;`.

**2c. Show role picker instead of login when no Supabase** (`src/App.jsx`):

When `supabase` is `null` and no role is selected, render the `Landing` component (role picker) instead of `LoginScreen`:
```jsx
import { supabase } from "./lib/supabase";
import Landing from "./components/Landing";

// In AppRoot, when !role:
if (!supabase) return <Landing onSelect={(key) => setRole(key)} />;
return <LoginScreen />;
```

**2d. Check all other files that import supabase:**

Search for `import.*supabase` across `src/`. Any file that calls `supabase.something()` must guard against `supabase` being `null`. Files that are only called when `VITE_USE_SUPABASE=true` (like `supabaseData.js` via `DataContext`) are safe — the code path won't execute.

**Why this matters**: `DataContext` already has a clean mock/Supabase toggle via `VITE_USE_SUPABASE`, but `supabase.js` and `AuthContext` had no such guard — they assumed Supabase was always available.

### Step 3: Add a Production Static Server

Vite's `dev` and `preview` commands are for local development. Databricks needs a proper server.

**Install `serve`:**
```bash
npm install serve
```

**Add `start` script to `package.json`:**
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "start": "serve dist -s -l 8000",
  ...
}
```

- `-s` = single-page app mode (rewrites all routes to `index.html`)
- `-l 8000` = listen on port 8000 (Databricks Apps default)

### Step 4: Create `app.yaml`

Create `app.yaml` in the app root:

```yaml
command: ['npm', 'run', 'start']
```

If the app needs environment variables (e.g., Supabase keys), add them:

```yaml
command: ['npm', 'run', 'start']
env:
  - name: VITE_SUPABASE_URL
    value: "https://your-project.supabase.co"
  - name: VITE_SUPABASE_ANON_KEY
    valueFrom: "databricks-secret-scope/supabase-anon-key"
```

> **Note**: Vite embeds env vars at BUILD time (not runtime). Variables prefixed with `VITE_` are baked into the `dist/` bundle during `npm run build`. For this prototype (all mock data), env vars may not be needed.

### Step 5: Update `.gitignore`

Add these entries if not already present:

```
# AI tooling (not needed in deployment)
.cursor/
.claude/
CLAUDE.md
twilio-mcp/

# Databricks local cache
.firecrawl/
```

### Step 6: Test Locally

Before deploying, verify the build + serve chain works:

```bash
npm run build
npm run start
# Visit http://localhost:8000 — app should work
```

### Step 7: Deploy to Databricks

#### Option A: Deploy from Git (recommended)

1. Push the cleaned-up code to GitHub
2. In Databricks workspace: **Compute** > **Apps** > **Create App**
3. **Configure Git repository**: enter the GitHub URL, select GitHub as provider
4. For private repos: configure Git credential on the app's service principal
5. Click **Create App**
6. Click **Deploy** > **From Git** > set reference to `main` > **Deploy**

#### Option B: Deploy from Workspace Folder (CLI)

```bash
# Install Databricks CLI
pip install databricks-cli

# Configure with workspace URL + token
databricks configure --token

# Update Databricks workspace repo to latest main
databricks repos update 3889324859208374 --branch main -p DanSiaoAuth

# Deploy from Databricks Repos path (canonical)
databricks apps deploy hertz-leo-leadsmgmtsystem \
  --source-code-path "/Workspace/Repos/nh136948@hertz.net/Prototype-LMS-Databricks" \
  -p DanSiaoAuth
```

### Step 8: Verify Deployment

- App details page shows status (building → running)
- Click the app link to open the deployed app
- Check **Logs** tab for any errors
- Confirm the app renders correctly and navigation works

---

## Change Log

All modifications made to prepare for Databricks deployment:

| Date | Change | Files |
|------|--------|-------|
| 2026-03-09 | Added `serve` dependency | `package.json` |
| 2026-03-09 | Added `start` script for production serving on port 8000 | `package.json` |
| 2026-03-09 | Created `app.yaml` with Databricks run command | `app.yaml` (new) |
| 2026-03-09 | Updated `.gitignore` with AI-tooling exclusions | `.gitignore` |
| 2026-03-09 | Created clean Databricks-ready repo on GitHub | `popcornAlesto33/Prototype-LMS-Databricks` |
| 2026-03-09 | Stripped AI tooling: `.cursor/`, `CLAUDE.md`, `twilio-mcp/`, MCP scripts, `vercel.json` | Excluded from new repo |
| 2026-03-09 | Made Supabase client null-safe (exports `null` when no credentials) | `src/lib/supabase.js` |
| 2026-03-09 | AuthContext skips auth when Supabase is null, stops loading immediately | `src/context/AuthContext.jsx` |
| 2026-03-09 | App shows Landing role picker instead of LoginScreen when no Supabase | `src/App.jsx` |

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Supabase URL is required" or blank screen on load | Supabase client crashes without credentials | Complete Step 2 — make supabase client export `null`, guard AuthContext, show Landing instead of LoginScreen |
| App fails to start | Port mismatch | Ensure `serve` uses `-l 8000` |
| Blank page after deploy | Build failed or wrong serve path | Check logs; ensure `dist/` is built |
| 404 on page refresh | SPA routing not configured | Ensure `serve -s` flag is set |
| Env vars undefined | Vite env vars are build-time only | Set `VITE_*` vars before `npm run build` in the Databricks environment |
| Git deploy fails (private repo) | Missing Git credential | Configure credential on the app's service principal |
| Build timeout | Large `node_modules` | Add `.npmrc` with `--prefer-offline` or trim unused dependencies |

---

## Notes for the Newer Repo

When porting the latest version of the LMS, follow the same steps above. Key differences to watch for:
- Check if the newer repo has additional dependencies or a different build setup
- Check if it uses a router library (may affect the `-s` flag behavior)
- Check for any backend API requirements (may need the FastAPI + StaticFiles pattern instead of `serve`)
- Review any new `.env` variables that need Databricks secrets configuration
- **Database: use Lakebase Postgres, not Delta tables.** The client advised against Unity Catalog Delta tables due to high latency for CRUD operations (SQL Warehouse cold start, compute overhead). Lakebase Postgres provides low-latency transactional access suitable for web apps. See `DATABRICKS-DATABASE-SETUP.md` for the full schema migration and FastAPI backend setup.
