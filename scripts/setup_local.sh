#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Local Development Setup Script
# Sets up the app to connect to the shared Neon DB so you can
# see the same data (org mapping, directives, leads, etc.)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${GREEN}=== LEO LMS Local Setup ===${NC}\n"

# ── 1. Check prerequisites ──────────────────────────────────
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗ python3 not found. Install Python 3.10+${NC}" && exit 1
fi
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ node not found. Install Node.js 18+${NC}" && exit 1
fi
if ! command -v npm &>/dev/null; then
  echo -e "${RED}✗ npm not found. Install Node.js 18+${NC}" && exit 1
fi
echo -e "${GREEN}✓ python3, node, npm found${NC}"

# ── 2. Create .env.local if missing ─────────────────────────
echo -e "\n${YELLOW}[2/5] Setting up .env.local...${NC}"

if [ -f .env.local ]; then
  echo -e "${GREEN}✓ .env.local already exists — skipping${NC}"
else
  echo -e "${YELLOW}Creating .env.local — you'll need the shared Neon DB credentials.${NC}"
  echo -e "Ask Bryan for the PGHOST, PGUSER, PGPASSWORD values.\n"

  read -rp "PGHOST: " pg_host
  read -rp "PGUSER [neondb_owner]: " pg_user
  pg_user="${pg_user:-neondb_owner}"
  read -rsp "PGPASSWORD: " pg_pass
  echo

  cat > .env.local <<EOF
APP_ENV=local
APP_TIER=local

# --- Neon DB (shared cloud Postgres) ---
PGHOST=${pg_host}
PGPORT=5432
PGDATABASE=lms_leo
PGUSER=${pg_user}
PGPASSWORD=${pg_pass}
PGSSLMODE=require

LEO_JWT_SECRET=leo-local-dev-secret
HLES_LANDING_VOLUME_PATH=./local-uploads/hles
TRANSLOG_LANDING_VOLUME_PATH=./local-uploads/translog
VITE_USE_LIVE_API=true
EOF

  echo -e "${GREEN}✓ .env.local created${NC}"
fi

# ── 3. Python venv + dependencies ───────────────────────────
echo -e "\n${YELLOW}[3/5] Setting up Python virtual environment...${NC}"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  echo -e "${GREEN}✓ Created .venv${NC}"
else
  echo -e "${GREEN}✓ .venv already exists${NC}"
fi

source .venv/bin/activate
pip install -q -r requirements.txt
echo -e "${GREEN}✓ Python dependencies installed${NC}"

# ── 4. Node dependencies ────────────────────────────────────
echo -e "\n${YELLOW}[4/5] Installing Node dependencies...${NC}"

npm install --silent
echo -e "${GREEN}✓ Node dependencies installed${NC}"

# ── 5. Create local upload dirs ─────────────────────────────
echo -e "\n${YELLOW}[5/5] Creating local upload directories...${NC}"

mkdir -p local-uploads/hles local-uploads/translog
echo -e "${GREEN}✓ local-uploads/ ready${NC}"

# ── Done ─────────────────────────────────────────────────────
echo -e "\n${GREEN}=== Setup complete! ===${NC}"
echo ""
echo "To start the app, run these in two separate terminals:"
echo ""
echo -e "  ${YELLOW}Terminal 1 (backend):${NC}"
echo "    source .venv/bin/activate"
echo "    source .env.local"
echo "    uvicorn main:app --reload --port 8080"
echo ""
echo -e "  ${YELLOW}Terminal 2 (frontend):${NC}"
echo "    npm run dev"
echo ""
echo "Then open http://localhost:5173 and log in with a shared account."
echo "(Ask Bryan for the login credentials)"
