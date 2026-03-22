#!/usr/bin/env bash
# macOS equivalent of start_local.ps1
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# --- activate Python venv ---
if [[ ! -f ".venv/bin/activate" ]]; then
  echo "ERROR: .venv not found. Run: uv venv --python 3.12 .venv && uv pip install -r requirements.txt" >&2
  exit 1
fi
source .venv/bin/activate

# --- load nvm so npm/node resolve correctly ---
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

ENV_FILE="${1:-.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing $ENV_FILE. Copy .env.local.example to .env.local first." >&2
  exit 1
fi

echo "[start-local] Loading environment from $ENV_FILE"
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

echo "[start-local] Checking PostgreSQL connectivity"
python -c "
import os, psycopg
kwargs = dict(
    host=os.environ['PGHOST'],
    dbname=os.environ['PGDATABASE'],
    user=os.environ['PGUSER'],
    password=os.environ['PGPASSWORD'],
    port=os.environ.get('PGPORT', '5432'),
)
if os.environ.get('PGSSLMODE'):
    kwargs['sslmode'] = os.environ['PGSSLMODE']
conn = psycopg.connect(**kwargs)
conn.close()
print('postgres-ok')
"

echo "[start-local] Starting FastAPI backend (:8000)"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

echo "[start-local] Starting Vite frontend (:5173)"
npm run dev &
FRONTEND_PID=$!

echo "[start-local] Started."
echo "  APP_ENV=$APP_ENV"
echo "  APP_TIER=$APP_TIER"
echo "  PGHOST=$PGHOST"
echo "  PGDATABASE=$PGDATABASE"
echo "  Backend PID: $BACKEND_PID  -> http://localhost:8000"
echo "  Frontend PID: $FRONTEND_PID -> http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both processes."

# Wait for both; kill both on Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
