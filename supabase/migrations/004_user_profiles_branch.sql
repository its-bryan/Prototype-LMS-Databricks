-- Hertz LMS - Add branch to user_profiles for BM→Branch mapping
-- One BM manages one branch. Run after 003_user_profiles.sql

alter table public.user_profiles
  add column if not exists branch text;

comment on column public.user_profiles.branch is 'Branch location for BM role; null for gm/admin';
