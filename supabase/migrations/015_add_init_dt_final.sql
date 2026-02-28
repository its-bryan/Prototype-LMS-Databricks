-- Hertz LMS - Add init_dt_final (Received Date) to leads
-- This column was present in mockData but never added to the DB schema.
-- INIT_DT_FINAL is the date the reservation/lead was initially received.
-- Run after 014_seed_50_additional_leads.sql

-- 1. Add the column
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS init_dt_final date;

COMMENT ON COLUMN public.leads.init_dt_final
  IS 'Date the reservation was initially received (INIT_DT_FINAL from HLES feed)';

-- 2. Backfill from last_activity - days_open for leads that have activity
UPDATE public.leads
SET init_dt_final = (last_activity::date - days_open * INTERVAL '1 day')::date
WHERE last_activity IS NOT NULL
  AND init_dt_final IS NULL;

-- 3. Backfill remaining leads (no activity, e.g. Unused) using current date - days_open
UPDATE public.leads
SET init_dt_final = (CURRENT_DATE - days_open * INTERVAL '1 day')::date
WHERE init_dt_final IS NULL;
