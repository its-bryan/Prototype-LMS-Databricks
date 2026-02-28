# Supabase Setup Guide

This guide walks you through connecting your Hertz LMS prototype to Supabase.

## 1. Create your `.env` file

Copy the example and add your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` and replace the placeholders with values from your [Supabase Dashboard](https://supabase.com/dashboard) → **Project Settings** → **API**:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY` (use the **Legacy API Keys** tab → `anon` key for best auth compatibility)

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Note:** Vite only exposes env vars prefixed with `VITE_` to the client. Never put your `service_role` key in the frontend.

### Login not working?

If you see "Invalid API key" or login fails silently, use the **legacy anon key** (JWT format, starts with `eyJ`) instead of the new publishable key (`sb_publishable_...`):

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **API**
2. Open the **Legacy API Keys** tab
3. Copy the `anon` key and set `VITE_SUPABASE_ANON_KEY` in `.env`

## 2. Run the database migrations

In the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/new):

1. Open `supabase/migrations/001_initial_schema.sql` and run it (creates tables + RLS).
2. Open `supabase/migrations/002_seed_data.sql` and run it (seeds mock data).

Or paste each file’s contents into a new query and click **Run**.

## 3. Verify the setup

After running the migrations, you should see:

- `org_mapping` – 15 rows
- `leads` – 5 rows
- `branch_managers` – 10 rows
- `weekly_trends` – 6 rows
- `upload_summary` – 1 row
- `leaderboard_data` – 1 row
- `cancellation_reason_categories` – 4 rows
- `next_actions` – 6 rows

## 4. Switch the app to use Supabase

The app currently uses `src/data/mockData.js`. To use Supabase instead:

1. Add `VITE_USE_SUPABASE=true` to your `.env`.
2. Update `src/selectors/demoSelectors.js` and other consumers to load data from `src/data/supabaseData.js` when that env var is set (or replace mock imports with Supabase calls).

Example pattern:

```javascript
// In a component or selector
const useSupabase = import.meta.env.VITE_USE_SUPABASE === 'true';

// Use fetchLeads(), fetchOrgMapping(), etc. from supabaseData.js
// when useSupabase is true; otherwise use mockData.
```

## 5. Tables overview

| Table | Purpose |
|-------|---------|
| `leads` | Main lead/reservation data; `translog` and `enrichment` stored as JSONB |
| `org_mapping` | BM → Branch → AM → GM → Zone hierarchy |
| `branch_managers` | BM metrics (conversion rate, quartile) |
| `weekly_trends` | BM and GM weekly metrics |
| `upload_summary` | Last HLES/TRANSLOG upload stats |
| `leaderboard_data` | Cached leaderboard (branches, GMs, AMs, zones) |
| `cancellation_reason_categories` | Dropdown options for BM comments |
| `next_actions` | Follow-up action options |

## 6. Row Level Security (RLS)

The migrations enable RLS with permissive policies for prototype use. Before production:

1. Add Supabase Auth (or your auth provider).
2. Replace the `"Allow public read/write"` policies with role-based policies.
3. Use the `service_role` key only on a trusted backend, never in the browser.

## 7. Data service API

`src/data/supabaseData.js` exposes:

- **Read:** `fetchLeads`, `fetchOrgMapping`, `fetchBranchManagers`, `fetchWeeklyTrends`, `fetchUploadSummary`, `fetchLeaderboardData`, `fetchCancellationReasonCategories`, `fetchNextActions`, `fetchDataAsOfDate`
- **Write:** `updateLeadEnrichment`, `updateLeadDirective`, `archiveLead`

All functions return data in the same shape as `mockData.js` for easy migration.
