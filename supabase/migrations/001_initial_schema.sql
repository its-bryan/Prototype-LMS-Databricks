-- Hertz LMS - Initial Supabase Schema
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query

-- Enable UUID extension (optional, for future auth)
create extension if not exists "uuid-ossp";

-- =============================================================================
-- ORG MAPPING: BM → Branch → AM → GM → Zone hierarchy
-- =============================================================================
create table org_mapping (
  id bigint generated always as identity primary key,
  bm text not null,
  branch text not null,
  am text not null,
  gm text,
  zone text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(branch)
);

-- =============================================================================
-- LEADS: Main lead/reservation data
-- =============================================================================
create table leads (
  id bigint generated always as identity primary key,
  customer text not null,
  reservation_id text not null unique,
  status text not null check (status in ('Rented', 'Cancelled', 'Unused', 'Reviewed')),
  archived boolean default false,
  enrichment_complete boolean default false,
  branch text not null,
  bm_name text not null,
  days_open int default 0,
  mismatch boolean default false,
  gm_directive text,
  insurance_company text,
  time_to_first_contact text,
  first_contact_by text check (first_contact_by in ('branch', 'hrd', 'none')),
  time_to_cancel text,
  hles_reason text,
  last_activity timestamptz,
  -- JSONB for nested structures (translog, enrichment, enrichment_log)
  translog jsonb default '[]'::jsonb,
  enrichment jsonb,
  enrichment_log jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_leads_status on leads(status);
create index idx_leads_branch on leads(branch);
create index idx_leads_archived on leads(archived);
create index idx_leads_enrichment_complete on leads(enrichment_complete);

-- =============================================================================
-- BRANCH MANAGERS: BM metrics
-- =============================================================================
create table branch_managers (
  id bigint generated always as identity primary key,
  name text not null unique,
  conversion_rate int not null,
  quartile int not null check (quartile between 1 and 4),
  created_at timestamptz default now()
);

-- =============================================================================
-- WEEKLY TRENDS: BM and GM weekly metrics
-- =============================================================================
create table weekly_trends (
  id bigint generated always as identity primary key,
  type text not null check (type in ('bm', 'gm')),
  week_label text not null,
  week_start date not null,
  -- BM metrics
  total_leads int,
  conversion_rate int,
  comment_rate int,
  -- GM metrics
  cancelled_unreviewed int,
  comment_compliance int,
  zone_conversion_rate int,
  time_to_contact jsonb,
  branch_contact_rate int,
  hrd_contact_rate int,
  created_at timestamptz default now(),
  unique(type, week_start)
);

-- =============================================================================
-- UPLOAD SUMMARY: Last HLES/TRANSLOG upload stats
-- =============================================================================
create table upload_summary (
  id bigint generated always as identity primary key,
  hles jsonb not null,
  translog jsonb not null,
  data_as_of_date text not null,
  created_at timestamptz default now()
);

-- =============================================================================
-- LEADERBOARD: Cached leaderboard data (optional - can be computed)
-- =============================================================================
create table leaderboard_data (
  id bigint generated always as identity primary key,
  branches jsonb,
  gms jsonb,
  ams jsonb,
  zones jsonb,
  created_at timestamptz default now()
);

-- =============================================================================
-- CANCELLATION REASON CATEGORIES: Config for dropdowns
-- =============================================================================
create table cancellation_reason_categories (
  id bigint generated always as identity primary key,
  category text not null,
  reasons jsonb not null default '[]'::jsonb,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- =============================================================================
-- NEXT ACTIONS: Config for BM follow-up dropdown
-- =============================================================================
create table next_actions (
  id bigint generated always as identity primary key,
  action text not null unique,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS for production; adjust policies as needed for your auth setup
-- =============================================================================
alter table org_mapping enable row level security;
alter table leads enable row level security;
alter table branch_managers enable row level security;
alter table weekly_trends enable row level security;
alter table upload_summary enable row level security;
alter table leaderboard_data enable row level security;
alter table cancellation_reason_categories enable row level security;
alter table next_actions enable row level security;

-- Policy: Allow read for anon (for prototype; tighten when auth is added)
create policy "Allow public read" on org_mapping for select using (true);
create policy "Allow public read" on leads for select using (true);
create policy "Allow public read" on branch_managers for select using (true);
create policy "Allow public read" on weekly_trends for select using (true);
create policy "Allow public read" on upload_summary for select using (true);
create policy "Allow public read" on leaderboard_data for select using (true);
create policy "Allow public read" on cancellation_reason_categories for select using (true);
create policy "Allow public read" on next_actions for select using (true);

-- Policy: Allow insert/update for authenticated users (placeholder - adjust when auth)
create policy "Allow public write" on org_mapping for all using (true);
create policy "Allow public write" on leads for all using (true);
create policy "Allow public write" on branch_managers for all using (true);
create policy "Allow public write" on weekly_trends for all using (true);
create policy "Allow public write" on upload_summary for all using (true);
create policy "Allow public write" on leaderboard_data for all using (true);
create policy "Allow public write" on cancellation_reason_categories for all using (true);
create policy "Allow public write" on next_actions for all using (true);
