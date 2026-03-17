# Databricks / Lakebase Learnings

> Lessons learned while connecting the LMS prototype to Databricks Lakebase Postgres. Reference this when making future backend changes.

---

## Lakebase Postgres Connection (from Databricks Apps)

### What works

```python
import os
import psycopg
from psycopg.rows import dict_row
from databricks.sdk import WorkspaceClient
from databricks.sdk.core import Config

app_config = Config()
_ws = WorkspaceClient()

_DB_HOST = os.getenv("PGHOST")          # Auto-set by Database resource
_DB_USER = app_config.client_id          # App's service principal ID
_DB_NAME = os.getenv("PGDATABASE", "databricks_postgres")

def get_connection():
    token = _ws.config.oauth_token().access_token  # Fresh token per connection
    return psycopg.connect(
        host=_DB_HOST, dbname=_DB_NAME, user=_DB_USER,
        password=token, sslmode="require", row_factory=dict_row,
    )
```

### Setup steps

1. **Add Database resource** in Databricks Apps UI → select your Lakebase database + branch (main)
2. This auto-sets `PGHOST`, `PGUSER`, `PGDATABASE`, `DATABRICKS_CLIENT_ID` env vars
3. Copy `DATABRICKS_CLIENT_ID` from the app's Environment tab
4. In Lakebase SQL editor, grant the app access:
   ```sql
   GRANT USAGE ON SCHEMA public TO "<CLIENT_ID>";
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "<CLIENT_ID>";
   ```
5. **Important**: Re-run the GRANT after creating new tables — the app won't have access to them automatically

### What does NOT work

| Approach | Why it fails |
|----------|-------------|
| `dbutils.secrets.get()` | Notebook/cluster only — not available in Databricks Apps |
| `w.secrets.get_secret()` | Works but returns base64-encoded values, requires ACL grants, and still can't store tokens (they expire) |
| Static OAuth token in secret scope | Tokens expire after ~1 hour |
| `app.yaml valueFrom: scope.key` | References Databricks Apps "resources", not workspace secret scopes |
| `app.yaml env value: "${VAR}"` | Shell expansion doesn't work in app.yaml |
| `w.config.authenticate()` | Returns HTTP headers, not a direct token — use `w.config.oauth_token().access_token` instead |
| Username = user's email | App runs as service principal — username must be `Config().client_id` |
| `psycopg2` | Works technically, but Databricks docs recommend psycopg3 for proper type handling |

### Token refresh

- `_ws.config.oauth_token().access_token` handles caching internally
- Only makes a network call when the cached token is near expiry
- Safe to call on every `get_connection()` — negligible overhead for most requests

---

## psycopg3 vs psycopg2

### Key differences

| Topic | psycopg2 | psycopg3 |
|-------|----------|----------|
| Package | `psycopg2-binary` | `psycopg[binary]>=3.1.0` |
| Dict rows | `RealDictCursor` | `row_factory=dict_row` on connection |
| JSONB params | `json.dumps(obj)` just works | Must use `%s::jsonb` cast or `Jsonb()` wrapper |
| Context manager | `with conn:` commits but doesn't close | `with psycopg.connect() as conn:` closes on exit |
| Type strictness | Lenient — sends everything as text | Strict — types parameters, Postgres may reject mismatches |

### JSONB handling

When passing `json.dumps(...)` to a JSONB column in psycopg3, add `::jsonb` cast in SQL:
```sql
-- Won't work (psycopg3 sends as text, Postgres rejects text→jsonb)
UPDATE leads SET enrichment = %s WHERE id = %s

-- Works
UPDATE leads SET enrichment = %s::jsonb WHERE id = %s
```

---

## Requirements

```
fastapi>=0.104.0
uvicorn>=0.24.0
psycopg[binary]>=3.1.0
databricks-sdk>=0.57.0
pandas>=2.0.0
openpyxl>=3.1.0
python-multipart>=0.0.6
```

---

## app.yaml

Keep it simple — no env vars or resources needed (the Database resource is configured in the UI, not in app.yaml):

```yaml
command: ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000']
```

---

## Deployment workflow

```bash
# From HertzDataAnalysis repo root:
git add docs/Prototype-LeadMgmtsys/prototype-lms/...
git commit -m "message"

# Push ONLY prototype-lms (never the full repo):
git subtree split --prefix=docs/Prototype-LeadMgmtsys/prototype-lms -b prototype-only
git push prototype-lms prototype-only:main --force
git push prototype-lms-databricks prototype-only:main --force
git branch -D prototype-only
```

Then on the Hertz laptop: `git pull`, rebuild if frontend changed (`npm run build`), redeploy via Databricks Apps.

---

## Database details

- **Host**: `ep-jolly-cherry-d2k7zib8.database.us-east-1.cloud.databricks.com`
- **Database**: `databricks_postgres`
- **Schema**: `public`
- **Tables (13)**: org_mapping, leads, branch_managers, weekly_trends, upload_summary, leaderboard_data, cancellation_reason_categories, next_actions, user_profiles, tasks, lead_activities, gm_directives, wins_learnings
- **Migration scripts**: `lakebase-migrations/001_full_schema.sql`, `002_seed_config.sql`, `003_phase2_tables.sql`

---

## Gotchas

1. **Use the Lakebase SQL editor** — Make sure you're connected to the correct database (`databricks_postgres`), not a different SQL editor. Standard Postgres types (`text`, `uuid`, `timestamptz`, `ON DELETE CASCADE`) all work in Lakebase — errors about unsupported types usually mean you're in the wrong editor
2. **New tables need GRANTs** — After creating tables in Lakebase SQL editor, you must grant the app's client ID access to them
2. **Seed data is demo-only** — org_mapping and user_profiles have dummy data; clear before production (see PROD-READY.md)
3. **Frontend is hardcoded to Databricks mode** — `DataContext.jsx` always imports `databricksData.js`, no build flag needed
4. **`USE_SUPABASE = true`** in DataContext.jsx means "use live data" (not mock), despite the name — it controls mock vs live code paths, not which backend
