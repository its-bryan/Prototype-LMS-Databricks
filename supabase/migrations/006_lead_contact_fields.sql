-- Hertz LMS - Contact fields for Email/SMS/Call feature
-- Run after 004_user_profiles_branch.sql
-- HLES/TRANSLOG first; BM enrichment fallback for email/phone

-- Leads: customer contact info (from HLES/TRANSLOG or BM enrichment)
alter table public.leads
  add column if not exists email text,
  add column if not exists phone text;

comment on column public.leads.email is 'Customer email — HLES/TRANSLOG or BM enrichment';
comment on column public.leads.phone is 'Customer phone (E.164) — HLES/TRANSLOG or BM enrichment';

-- User profiles: BM phone for click-to-call
alter table public.user_profiles
  add column if not exists phone text;

comment on column public.user_profiles.phone is 'BM phone (E.164) for Twilio click-to-call';
