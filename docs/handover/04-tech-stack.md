# 04 -- Technology Stack Inventory

> Part of the LEO LMS handover pack.
> Cross-reference [02-technical-architecture.md](02-technical-architecture.md) for how these pieces fit together at runtime.

---

## 1. Frontend Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.0 | UI component library (React 19 with concurrent features) |
| `react-dom` | ^19.2.0 | DOM renderer for React |
| `react-router-dom` | ^7.13.1 | Client-side routing (BM, GM, Admin role-based layouts) |
| `framer-motion` | ^12.34.3 | Animation library -- modal transitions, card stagger, hover effects |
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop framework for task reordering in Work Hub |
| `@dnd-kit/utilities` | ^3.2.2 | Helper utilities for @dnd-kit (CSS, transforms) |
| `papaparse` | ^5.5.3 | CSV parsing for admin bulk-upload flows |
| `xlsx` | ^0.18.5 | Excel file generation for data export / download features |
| `canvas-confetti` | ^1.9.3 | Confetti animation on achievement milestones (leaderboard) |
| `serve` | ^14.2.6 | Static file server used in production (`npm start` serves `dist/`) |

## 2. Frontend Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^7.3.1 | Build tool and dev server (ESM-native, sub-second HMR) |
| `@vitejs/plugin-react` | ^5.1.1 | React Fast Refresh + JSX transform for Vite |
| `tailwindcss` | ^4.2.1 | Utility-first CSS framework (v4 -- no config file, auto-discovery) |
| `@tailwindcss/vite` | ^4.2.1 | Tailwind CSS Vite plugin (replaces PostCSS setup) |
| `vitest` | ^4.1.0 | Unit / integration test runner (Vite-native) |
| `@playwright/test` | ^1.58.2 | End-to-end test framework (browser automation) |
| `playwright` | ^1.58.2 | Browser binaries managed by Playwright |
| `eslint` | ^9.39.1 | JavaScript linter (flat config format) |
| `@eslint/js` | ^9.39.1 | ESLint core recommended rules |
| `eslint-plugin-react-hooks` | ^7.0.1 | Lint rules enforcing React Hooks conventions |
| `eslint-plugin-react-refresh` | ^0.4.24 | Lint rules for React Refresh / HMR correctness |
| `dotenv` | ^17.3.1 | Loads `.env` files for Node scripts (seed, diagnose) |
| `globals` | ^16.5.0 | Provides browser/node global variable lists for ESLint |
| `@types/react` | ^19.2.7 | TypeScript type definitions for React (used by IDE tooling) |
| `@types/react-dom` | ^19.2.3 | TypeScript type definitions for ReactDOM |

## 3. Backend Dependencies (Python)

| Package | Version Constraint | Purpose |
|---|---|---|
| `fastapi` | >=0.104.0 | Async web framework -- all `/api/*` endpoints |
| `uvicorn` | >=0.24.0 | ASGI server (runs FastAPI in production and development) |
| `psycopg[binary]` | >=3.1.0 | PostgreSQL driver (psycopg 3, async-capable, binary wheels) |
| `psycopg-pool` | >=3.2.0 | Connection pooling for psycopg 3 |
| `pandas` | >=2.0.0 | DataFrame operations in snapshot pipeline and CSV/Excel processing |
| `openpyxl` | >=3.1.0 | Excel (.xlsx) read/write support for pandas and upload parsing |
| `python-multipart` | >=0.0.6 | Multipart form parsing (required by FastAPI file upload endpoints) |
| `databricks-sdk` | >=0.89.0 | Databricks API client -- Unity Catalog Volumes, workspace auth |
| `pyjwt` | >=2.8.0 | JWT encoding/decoding for session authentication |
| `bcrypt` | >=4.0.0 | Password hashing (Blowfish-based, used for admin/user credentials) |

## 4. Infrastructure

| Component | Detail |
|---|---|
| **Databricks Apps** | Deployment target. Configured via `app.yaml` at repo root. Two named apps: `hertz-leo-lms-staging` (staging tier, `lms_staging` DB) and `hertz-leo-leadsmgmtsystem` (production tier, `databricks_postgres` DB). |
| **Databricks Lakebase (Postgres)** | Managed PostgreSQL database. Accessed via `psycopg` with connection parameters injected by the Databricks Apps runtime. No external Postgres instance required. |
| **Unity Catalog Volumes** | File storage for uploaded CSVs and generated snapshots. Accessed through `databricks-sdk`. The endpoint is configured via the `ENDPOINT_NAME` env var in `app.yaml`. |
| **Static Frontend Hosting** | In production, `serve` serves the Vite-built `dist/` directory on port 8000 alongside the FastAPI backend (both behind the Databricks Apps reverse proxy). |

### `app.yaml` Startup Sequence

```
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

The shell wrapper selects environment variables (`APP_ENV`, `APP_TIER`, `PGDATABASE`) based on `DATABRICKS_APP_NAME`.

## 5. Language & Runtime Versions

| Runtime | Version | Notes |
|---|---|---|
| **Python** | 3.12 | Databricks Apps base image. Used for backend and snapshot scripts. |
| **Node.js** | 22.x | Local development and CI. Required for Vite build and Playwright. |

## 6. Build & Dev Toolchain

### Vite (`vite.config.js`)

- **Plugins:** `@vitejs/plugin-react` (JSX + Fast Refresh) and `@tailwindcss/vite` (Tailwind v4 integration).
- **Dev proxy:** `/api` requests forwarded to `http://localhost:8000` (FastAPI backend).
- No custom aliases, no SSR, no manual chunk splitting.

### Vitest (`vitest.config.js`)

- **Environment:** `node` (not jsdom -- tests target selectors and logic, not DOM rendering).
- **Test pattern:** `src/**/*.test.{js,jsx}`.
- **Globals:** enabled (`describe`, `it`, `expect` available without imports).
- Uses the same `@vitejs/plugin-react` plugin for JSX support in test files.

### Playwright (`e2e/playwright.config.ts`)

- **Browser:** Chromium only (single project).
- **Workers:** 1 (serial execution -- tests share auth state).
- **Timeout:** 90 seconds per test, 10 seconds for `expect` assertions.
- **Credentials:** loaded from `.env.test` (gitignored) via `dotenv`.
- **Web server:** auto-starts `npm run dev` on port 5173 if not already running.
- **Artifacts:** screenshots on failure, traces retained on failure, HTML report generated but not auto-opened.
- **Test directories:** `gm/**/*.spec.ts`, `bm/**/*.spec.ts`, `admin/**/*.spec.ts`.

### ESLint (`eslint.config.js`)

- **Format:** ESLint v9 flat config.
- **Scope:** `**/*.{js,jsx}` files, ignores `dist/`.
- **Rule sets:** `@eslint/js` recommended, `react-hooks` recommended, `react-refresh` Vite preset.
- **Custom rule:** `no-unused-vars` ignores variables starting with uppercase or underscore (component imports, intentional discards).

## 7. Design System

### CSS Custom Properties (`src/styles/hertz-brand.css`)

All brand tokens (colors, typography, spacing, shadows, radii, transitions, breakpoints) are defined as CSS custom properties prefixed `--hertz-*`. These are consumed directly in Tailwind utility classes via `var()` and in inline styles. See [project_design_tokens.md](../../.claude/projects/-Users-bryangunawan-Prototype-LMS-Databricks/memory/project_design_tokens.md) for the full token inventory.

### Tailwind CSS v4

Tailwind v4 uses **auto-discovery** -- there is no `tailwind.config.js` file. The `@import "tailwindcss"` directive in `src/index.css` activates the framework, and the `@tailwindcss/vite` plugin handles scanning and generation at build time. Custom theme extensions (e.g., the `hertz-pulse` animation) are declared inline via `@theme` blocks in `index.css`.

### Framer Motion

Used consistently for:
- Modal/panel enter/exit animations (`AnimatePresence`)
- Card stagger patterns on list pages
- Hover and tap micro-interactions
- Loading skeleton pulses
- Reduced-motion support via `@media (prefers-reduced-motion: reduce)`

## 8. NPM Scripts Reference

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start Vite dev server with HMR on port 5173 |
| `build` | `vite build` | Production build to `dist/` |
| `start` | `serve dist -s -l 8000` | Serve production build on port 8000 (SPA fallback mode) |
| `preview` | `vite preview` | Preview production build locally via Vite |
| `lint` | `eslint .` | Run ESLint across the project |
| `test` | `vitest run` | Run unit/integration tests once |
| `test:watch` | `vitest` | Run tests in watch mode |
| `test:e2e` | `playwright test --config e2e/playwright.config.ts` | Run Playwright end-to-end tests |
| `test:supabase` | `node --env-file=.env scripts/test-supabase.mjs` | Legacy Supabase connection test script |
| `seed:users` | `node scripts/seed-demo-users.mjs` | Seed demo user accounts into the database |
| `fix:vikram` | `node scripts/fix-vikram-user.mjs` | One-off fix script for a specific user record |
| `fix:bm-branch` | `node scripts/fix-bm-branch.mjs` | One-off fix script for BM branch mapping |
| `diagnose:auth` | `node --env-file=.env scripts/diagnose-auth.mjs` | Diagnose authentication issues against the DB |

## 9. What is NOT Used (and Why)

| Technology | Status | Rationale |
|---|---|---|
| **ORM (SQLAlchemy, Prisma, etc.)** | Not used | Raw SQL via `psycopg` is required for Databricks Lakebase compatibility. Lakebase supports standard Postgres wire protocol but not all ORM-generated DDL/query patterns. Raw SQL also gives full control over the snapshot pipeline queries. |
| **Component library (MUI, Chakra, shadcn)** | Not used | Tailwind utility classes provide full design control without fighting library opinions. The Hertz brand system uses custom tokens that would conflict with library defaults. |
| **Redux / Zustand** | Not used | React Context API is sufficient for the app's state needs (auth context, role context, filter state). No global store required -- data is fetched per-page via `useEffect` and held in component state. |
| **Cookies for auth** | Not used | JWT tokens are stored in `sessionStorage` to avoid CORS cookie-handling complexity on the Databricks Apps reverse proxy. Session ends when the tab closes. |
| **GraphQL** | Not used | REST endpoints are simpler for the current API surface. Each page has 1-2 dedicated endpoints; there is no deep nesting or field-selection problem that GraphQL solves. |
| **TypeScript (for app code)** | Not used | Application code is plain JavaScript (`.js`/`.jsx`). TypeScript type packages are installed only for IDE IntelliSense. E2E tests under `e2e/` are written in TypeScript. |
