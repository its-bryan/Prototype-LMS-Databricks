-- Hertz LMS - Onboarding completion tracking for first-time user tour
-- Run after 012_tasks_notes_log.sql
-- null = show onboarding on first login; set when user completes or skips tour

alter table public.user_profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.user_profiles.onboarding_completed_at is
  'When user completed or skipped first-time onboarding; null = show onboarding';
