# LEO — Handover Documentation

**LEO** (Lead Management System) is a full-stack web application for Hertz insurance replacement branch managers and general managers to track, enrich, and review lead conversion activity — replacing manual Excel/HLES workflows with a unified dashboard, task management, and compliance monitoring system.

---

## Document Inventory

| # | Document | Audience | Description |
|---|----------|----------|-------------|
| 1 | [Business Context & Glossary](01-business-context-glossary.md) | Both | What LEO does, domain terminology, user roles, key metrics, data sources |
| 2 | [Technical Architecture](02-technical-architecture.md) | Both | System diagrams, frontend/backend architecture, API inventory, design decisions |
| 3 | [Infrastructure & Deployment](03-infrastructure-deployment.md) | Both | Environment topology, deployment pipeline, connection architecture, safety guards |
| 4 | [Technology Stack](04-tech-stack.md) | Technical | Full dependency inventory with versions and rationale |
| 5 | [Database Diagrams](05-database-diagrams.md) | Technical | Mermaid ER diagrams, table groups, relationships, indexes |
| 6 | [Data Models](06-data-models.md) | Technical | Every table's columns, JSONB schemas, ETL mapping, lead lifecycle |
| 7 | [Known Issues & Tech Debt](07-known-issues-tech-debt.md) | Both | Bugs, security concerns, tech debt, priority matrix |
| 8 | [Operational Runbook](08-operational-runbook.md) | Technical | Setup, ops tasks, troubleshooting, incident response, scripts inventory |
| 9 | [Security & Access Control](09-security-access-control.md) | Both | Auth flow, RBAC, secrets management, data protection, gaps |

---

## Reading Path: New Engineer

Start here if you're joining the team and need to get productive quickly.

1. **[Business Context & Glossary](01-business-context-glossary.md)** — understand the domain first
2. **[Technical Architecture](02-technical-architecture.md)** — understand the system
3. **[Technology Stack](04-tech-stack.md)** — know what you're working with
4. **[Database Diagrams](05-database-diagrams.md)** — see the data model
5. **[Data Models](06-data-models.md)** — deep dive on tables and JSONB schemas
6. **[Infrastructure & Deployment](03-infrastructure-deployment.md)** — understand environments
7. **[Operational Runbook](08-operational-runbook.md)** — get local dev running
8. **[Security & Access Control](09-security-access-control.md)** — auth and access patterns
9. **[Known Issues & Tech Debt](07-known-issues-tech-debt.md)** — know what to watch out for

## Reading Path: Stakeholder / Management

Focus on these sections for a high-level understanding.

1. **[Business Context & Glossary](01-business-context-glossary.md)** — sections 1-4 (executive summary, problem, roles, workflows)
2. **[Technical Architecture](02-technical-architecture.md)** — section 1 (architecture overview) + diagrams
3. **[Infrastructure & Deployment](03-infrastructure-deployment.md)** — sections 1-2 (topology overview)
4. **[Known Issues & Tech Debt](07-known-issues-tech-debt.md)** — sections 1 + 7 (executive summary + priority matrix)
5. **[Security & Access Control](09-security-access-control.md)** — sections 1 + 9 (overview + gaps)

---

## Repository Map

```
Prototype-LMS-Databricks/
├── main.py                    # FastAPI application entry point
├── db.py                      # Database connection pool + OAuth credentials
├── app.yaml                   # Databricks Apps deployment config
├── requirements.txt           # Python backend dependencies
├── package.json               # Node frontend dependencies
├── vite.config.js             # Vite build configuration
│
├── routers/                   # FastAPI API route handlers (10 routers)
│   ├── auth.py                #   JWT authentication
│   ├── leads.py               #   Lead CRUD + enrichment + activity report
│   ├── tasks.py               #   Task management
│   ├── config.py              #   Config & reference data
│   ├── upload.py              #   HLES/TRANSLOG data ingestion
│   ├── snapshot.py            #   Dashboard snapshot API
│   ├── observatory.py         #   Observatory metrics API
│   ├── directives.py          #   GM directives
│   ├── wins.py                #   Wins & learnings
│   └── feedback.py            #   User feedback & feature requests
│
├── services/                  # Business logic services
│   ├── snapshot.py            #   Dashboard metrics computation
│   ├── observatory_snapshot.py #  Observatory metrics computation
│   └── days_open.py           #   Lead age calculation
│
├── etl/                       # Data cleaning pipeline
│   └── clean.py               #   HLES/TRANSLOG column mapping + normalization
│
├── src/                       # React frontend
│   ├── main.jsx               #   App entry point
│   ├── router.jsx             #   Route definitions (BM/GM/Admin)
│   ├── context/               #   AuthContext, AppContext, DataContext
│   ├── components/            #   53 UI components
│   ├── selectors/             #   Metric computation from snapshots
│   ├── data/                  #   API client (databricksData.js) + mock data
│   ├── styles/                #   Design tokens (hertz-brand.css)
│   └── utils/                 #   Shared utilities
│
├── e2e/                       # Playwright end-to-end tests
│   ├── playwright.config.ts
│   ├── bm/                    #   Branch Manager tests
│   ├── gm/                    #   General Manager tests
│   ├── admin/                 #   Admin tests
│   └── helpers/               #   Auth, snapshot, admin helpers
│
├── scripts/                   # Operational scripts (19 files)
│   ├── deploy_staging.ps1     #   Staging deployment pipeline
│   ├── deploy_prod.ps1        #   Production deployment pipeline
│   ├── smoke_test.py          #   Integration smoke tests
│   └── ...                    #   Setup, seed, migration, testing scripts
│
├── docs/                      # Documentation
│   ├── handover/              #   THIS DOCUMENTATION SUITE
│   └── lakebase-migrations/   #   18 SQL migration files
│
└── dist/                      # Production build output (served by FastAPI)
```

---

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd Prototype-LMS-Databricks
npm install
pip install -r requirements.txt

# Configure environment
cp .env.local.example .env.local   # Fill in Postgres credentials

# Initialize database
python scripts/run_setup_db.py

# Seed test data
python scripts/seed_local_data.py

# Run (two terminals)
uvicorn main:app --reload          # Backend on :8000
npm run dev                        # Frontend on :5173 (proxies /api to :8000)
```

---

## Historical Context

These earlier docs in `docs/` predate this handover suite. They are preserved for historical reference but are superseded by the documents above:

- `HANDOFF-BRIEF.md` — Dan's original handoff (Feb 2026, pre-backend era)
- `HANDOFF-ETL-PHASE2.md` — ETL fix + Phase 2 completion (Mar 2026)
- `DEPLOYMENT-WORKFLOW.md` — Deployment pipeline (now in 03-infrastructure-deployment)
- `LOCAL-DEV-SETUP.md` — Local setup (now in 08-operational-runbook)
- `DATABRICKS-DATABASE-SETUP.md` — DB setup (now in 03-infrastructure-deployment)
- `DatabricksLearnings.md` — Databricks gotchas (now in 03-infrastructure-deployment)
- `PROD-READY.md` — Production readiness checklist (now in 07-known-issues-tech-debt)
